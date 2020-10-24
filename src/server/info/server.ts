import { getLogger } from '@util/logger';

import cors from 'cors';
import express from 'express';
import formidable from 'express-formidable';
import { createServer } from 'http';
import isEqual from 'lodash.isequal';
import merge from 'lodash.merge';
import ws from 'ws';

import Break from '@models/break';
import Game, { nullGame } from '@models/game';
import * as Games from '@models/games';
import LowerThird from '@models/lower-third';
import Match, { nullMatch } from '@models/match';
import matchList from '@models/matches';
import * as People from '@models/people';
import Person, { getPrefixedName } from '@models/person';
import Player, { nullPlayer } from '@models/player';
import Scoreboard from '@models/scoreboard';
import TournamentSet, { TournamentParticipant } from '@models/tournament-set';
import { getConfig } from '@util/configuration/config';
import { filterValues } from '@util/object';
import { parseFormData } from '@util/parsing';
import BracketState from '@server/bracket/state';
import { BRACKETS_PORT } from '@server/ports';

import FileOutput from './output/file/output';
import Output from './output/output';
import ScoreboardAssistant from './output/scoreboard-assistant';
import WebSocketOutput from './output/websocket/output';
import State, { nullState } from './state';

const logger = getLogger('server/info');
const state: State = Object.assign({}, nullState);
let socketServer: ws.Server | null = null;

interface PersonForm extends Partial<Person> {
  handleOrAlias?: string;
}

type PlayerForm = PersonForm & {
  score: string;
  inLosers: string;
  comment: string;
};

interface MatchLocator {
  id?: string;
  name?: string;
}

interface GameLocator {
  id?: string;
  name?: string;
}

type SetLocator = Partial<TournamentSet['serviceInfo']>;

interface ScoreboardForm {
  players: PlayerForm[];
  match: MatchLocator;
  game: GameLocator;
  set: SetLocator;
}

interface LowerThirdForm {
  players: PlayerForm[];
  tournament?: string;
  event?: string;
}

interface FillBracketForm {
  set: SetLocator;
}

export default async function start(port: number): Promise<void> {
  await loadDatabases();

  const outputs = loadOutputs();
  Promise.all(outputs.map(o => o.init()));
  logger.info('Initializing overlay info server');

  const app = express();
  // TODO: Security?
  app.use(cors());
  app.use(formidable());
  app.get('/state', (req, res) => {
    res.send(state);
  });
  app.post('/scoreboard', async (req, res) => {
    logger.debug(`Scoreboard update received:\n`, req.fields);
    if (!req.fields) {
      res.sendStatus(400);
      return;
    }
    const { unfinishedSets } = await getBracketState();
    const scoreboard = parseScoreboard(
      parseFormData(req.fields) as unknown as ScoreboardForm,
      unfinishedSets);
    updatePeople(state.commentators);
    Object.assign(state, scoreboard);
    res.sendStatus(200);
    broadcastState(state);
    outputs.forEach(o => o.update(state));
  });
  app.post('/scoreboardBracketFill', async (req, res) => {
    logger.debug(`Bracket set fill update received:\n`, req.fields);
    if (!req.fields) {
      res.sendStatus(400);
      return;
    }
    const { unfinishedSets } = await getBracketState();
    const scoreboard = fillBracketSet(
      parseFormData(req.fields) as unknown as FillBracketForm,
      unfinishedSets);
    Object.assign(state, scoreboard);
    res.sendStatus(200);
    broadcastState(state);
    outputs.forEach(o => o.update(state));
  });
  app.post('/lowerthird', (req, res) => {
    logger.debug(`Lower third update received:\n`, req.fields);
    if (!req.fields) {
      res.sendStatus(400);
      return;
    }
    const lowerThird = parseLowerThird(parseFormData(req.fields) as unknown as LowerThirdForm);
    updatePeople(state.players);
    Object.assign(state, lowerThird);
    res.sendStatus(200);
    broadcastState(state);
    outputs.forEach(o => o.update(state));
  });
  app.post('/break', (req, res) => {
    logger.debug(`Break update received:\n`, req.fields);
    if (!req.fields) {
      res.sendStatus(400);
      return;
    }
    const brk = parseBreak(req.fields);
    Object.assign(state, brk);
    res.sendStatus(200);
    broadcastState(state);
    outputs.forEach(o => o.update(state));
  });
  app.get('/people', (req, res) => {
    const query = req.query['q'];
    if (query == null || typeof query !== 'string' || !query.length) {
      res.sendStatus(400);
      return;
    }
    res.send(People.search(query));
  });
  app.get('/people/:id', (req, res) => {
    const id = req.params['id'];
    res.send(People.getById(id));
  });
  app.get('/games', (_, res) => {
    res.send(Games.getGames());
  });
  app.get('/matches', (_, res) => {
    res.send(matchList);
  });

  const httpServer = createServer(app);
  socketServer = new ws.Server({
    server: httpServer,
  });
  socketServer.on('connection', function connection(ws): void {
    ws.send(JSON.stringify(state));
    logger.info('Websocket connection received');
  });

  httpServer.listen(port, () => logger.info(`Listening on port ${port}`));
}

function broadcastState(state: State): void {
  if (!socketServer) {
    return;
  }
  //logger.debug('Broadcasting state: ', state);
  socketServer.clients.forEach(client => {
    if (client.readyState === ws.OPEN) {
      client.send(JSON.stringify(state));
    }
  });
}

async function loadDatabases(): Promise<void> {
  await People.loadDatabase();
  await Games.loadGameDatabase();
}

function loadOutputs(): Output[] {
  const outputs = getConfig().outputs;
  if (outputs.length === 0) {
    return [ new ScoreboardAssistant() ];
  }
  return outputs.map((conf): Output => {
    switch (conf.type) {
      case 'websocket':
        return new WebSocketOutput(conf);
        break;
      case 'file':
        return new FileOutput(conf);
        break;
      default:
        throw new Error('Output type not supported');
    }
  });
}

// TODO: Subscribe to player id?
function updatePeople(list: { person: Person }[]): void {
  list.forEach(x => {
    if (x.person.id == null || x.person.id === '') {
      return;
    }
    const p = People.getById(x.person.id);
    if (p == null) {
      return;
    }
    x.person = p;
  });
}

function parseScoreboard(
  form: ScoreboardForm,
  unfinishedSets: TournamentSet[],
): Scoreboard {
  const players = [];
  for (let i = 0; i < 2; i++) {
    const player = form.players[i];
    const person = parsePerson(player);

    const score = parseNumber(player.score);
    const inLosers = parseBool(player.inLosers);
    const comment = parseString(player.comment);
    players.push({ person, score, inLosers, comment });
  }

  const match = parseMatch(form.match);
  const game = parseGame(form.game);
  const set = parseSet(form.set, unfinishedSets);
  // TODO: Reload people from datastore?

  return {
    players,
    match,
    game,
    set,
  };
}

function fillBracketSet(
  form: FillBracketForm,
  unfinishedSets: TournamentSet[],
): Partial<Scoreboard> {
  const set = parseSet(form.set, unfinishedSets);
  if (!set) {
    return {};
  }
  const scoreboard: Partial<Scoreboard> = {
    set,
    players: playersFromSet(set).concat([
      nullPlayer,
      nullPlayer,
    ]).slice(0, 2),
  };
  if (set.match) {
    scoreboard.match = set.match;
  }
  if (set.videogame) {
    scoreboard.game = set.videogame;
  }

  return scoreboard;
}

function playersFromSet(set: TournamentSet): Player[] {
  // TODO: Handle discrepancies between numbers of players and entrants?
  return set.entrants.map(entrant => {
    const soloParticipant = entrant.participants.length == 1;
    if (soloParticipant) {
      return getOrCreatePlayer(entrant);
    } else {
      return getOrCreateTeam(entrant);
    }
  });
}

function getOrCreatePlayer(entrant: TournamentSet['entrants'][0]): Player {
  const participant = entrant.participants[0];

  const foundById = People.getByServiceId(participant.serviceName, participant.serviceId);
  if (foundById) {
    return {
      person: mergeSetParticipant(foundById, participant),
      score: 0,
      inLosers: entrant.inLosers,
    };
  }

  const foundPeople = People.findByFullName(getPrefixedName(participant));
  if (foundPeople.length == 1) {
    return {
      person: mergeSetParticipant(foundPeople[0], participant),
      score: 0,
      inLosers: entrant.inLosers,
    };
  }

  return {
    person: newPersonFromParticipant(participant),
    score: 0,
    inLosers: entrant.inLosers,
  };
}

function mergeSetParticipant(orig: Person, {
  serviceName,
  serviceId,
  ...incoming
}: TournamentParticipant): Person {
  const extra: Partial<Person> = {
    serviceIds: {
      [serviceName]: serviceId,
    },
  };
  if (incoming.handle !== orig.handle) {
    extra.alias = incoming.handle;
  }
  delete incoming.handle;
  const merged = merge({}, orig, incoming, extra);
  return People.save(merged);
}

function newPersonFromParticipant({
  serviceName,
  serviceId,
  ...person
}: TournamentParticipant): Person {
  const withServiceId = merge({}, person, {
    serviceIds: {
      [serviceName]: serviceId,
    },
  });
  return People.save(withServiceId);
}

function getOrCreateTeam(entrant: TournamentSet['entrants'][0]): Player {
  const foundPeople = People.findByFullName(entrant.name);
  if (foundPeople.length == 1) {
    return {
      person: foundPeople[0],
      score: 0,
      inLosers: entrant.inLosers,
    };
  }

  const newPerson = People.save({ handle: entrant.name });
  return {
    person: newPerson,
    score: 0,
    inLosers: entrant.inLosers,
  };
}

function parseLowerThird(form: LowerThirdForm): LowerThird {
  const commentators = [];
  for (let i = 0; i < 2; i++) {
    const person = parsePerson(form.players[i]);
    commentators.push({ person });
  }
  // TODO: Reload people from datastore?
  return {
    commentators,
    tournament: parseString(form.tournament),
    event: parseString(form.event),
  };
}

function parseBreak(fields: Record<string, unknown>): Break {
  const messages = [];
  for (let i = 0; i < 4; i++) {
    const msg = parseOptionalString(fields[`messages[${i}]`]);
    if (msg != null) {
      messages[i] = msg;
    }
  }
  return {
    messages,
  };
}

function parsePerson(form: PersonForm): Person {
  const id = parseString(form.id);
  const handle = parseString(form.handle);
  const alias = parseOptionalString(form.alias);
  const prefix = parseOptionalString(form.prefix) || null;
  const serviceIds = filterValues(form.serviceIds, value => !!value);
  return People.save(filterValues({
    id,
    handle,
    alias,
    prefix,
    serviceIds,
  }, value => value !== undefined));
}

function parseGame(locator: GameLocator): Game {
  const id = parseOptionalString(locator.id);
  if (id) {
    const found = Games.getGameById(id);
    if (found) {
      return found;
    }
  }
  const name = parseOptionalString(locator.name);
  if (!name) {
    return nullGame;
  }
  return Object.assign({}, nullGame, {
    name,
  });
}

function parseMatch(locator: MatchLocator): Match {
  const id = parseOptionalString(locator.id);
  if (id) {
    const found = matchList.find(m => m.id === id);
    if (found) {
      return found;
    }
  }
  const name = parseOptionalString(locator.name);
  if (!name) {
    return nullMatch;
  }
  return Object.assign({}, nullMatch, {
    name,
  });
}

function parseSet(
  locator: SetLocator,
  unfinishedSets: TournamentSet[],
): TournamentSet | undefined {
  return unfinishedSets.find(s => isEqual(s.serviceInfo, locator));
}

function parseOptionalString(value: unknown): string | undefined {
  return (typeof value === 'string' && value.trim()) || undefined;
}

function parseString(value: unknown): string {
  return parseOptionalString(value) || '';
}

function parseNumber(value: unknown): number {
  const str = parseString(value);
  return parseInt(str) || 0;
}

function parseBool(value: string | undefined): boolean {
  return !!value;
}

function getBracketState(): Promise<BracketState> {
  return fetch(`http://localhost:${BRACKETS_PORT}/state`)
    .then(resp => resp.json());
}
