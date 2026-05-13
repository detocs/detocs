import { getLogger } from '@util/logger.ts';

import cors from 'cors';
import express, { Application, Request, Response } from 'express';
import formidable from 'express-formidable';
import { createServer, Server } from 'http';
import updateImmutable from 'immutability-helper';
import isEqual from 'lodash.isequal';
import merge from 'lodash.merge';
import range from 'lodash.range';
import ws from 'ws';

import Break from '@models/break.ts';
import Game, { nullGame } from '@models/game.ts';
import GameCharacter, { nullGameCharacter } from '@models/game-character.ts';
import GameTeam, { nullGameTeam } from '@models/game-team.ts';
import { GameDatabase } from '@models/games.ts';
import Locality from '@models/locality.ts';
import LowerThird from '@models/lower-third.ts';
import Match, { nullMatch } from '@models/match.ts';
import matchList from '@models/matches.ts';
import PersonDatabase from '@models/people.ts';
import Person from '@models/person.ts';
import Player, { nullPlayer } from '@models/player.ts';
import Scoreboard from '@models/scoreboard.ts';
import TournamentSet from '@models/tournament-set.ts';
import BracketState from '@server/bracket/state.ts';
import { BRACKETS_PORT } from '@server/ports.ts';
import { OutputConfig } from '@util/configuration/config.ts';
import { entrantToPerson } from '@util/entrant.ts';
import { filterValues, mapValues } from '@util/object.ts';
import { parseFormData } from '@util/parsing.ts';
import { isObject, isStringRecordEntry } from '@util/predicates.ts';

import FileOutput from './output/file/output.ts';
import HttpClientOutput from './output/http-client/output.ts';
import Output from './output/output.ts';
import WebSocketOutput from './output/websocket/output.ts';
import WebSocketClientOutput from './output/websocket-client/output.ts';
import State, { nullState } from './state.ts';

const logger = getLogger('server/info');
const state: State = Object.assign({}, nullState);
let socketServer: ws.Server | null = null;
let personDb = null as unknown as PersonDatabase;

interface PersonForm extends Partial<Person> {
  handleOrAlias?: string;
}

type PlayerForm = PersonForm & {
  score: string;
  inLosers: string;
  comment: string;
  teams?: GameTeam[];
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

interface IncrementScoreParams {
  index?: string,
  player?: string, // 1-indexed instead of 0-indexed
  amount?: string,
}

// TODO: InfoServer class
export default async function start({
  port,
  personDatabase,
  gameDatabase,
  outputConfigs,
  defaultState,
}: {
  port: number,
  personDatabase: PersonDatabase,
  gameDatabase: GameDatabase,
  outputConfigs: OutputConfig[],
  defaultState: Partial<State>,
}): Promise<Server> {
  personDb = personDatabase;

  logger.info('Initializing overlay info server');
  loadDefaultState(defaultState);
  const outputs = loadOutputs(outputConfigs);
  Promise.all(outputs.map(o => o.init(state)));

  const app = express();
  // TODO: Security?
  app.use(cors());
  app.use(formidable());
  app.get('/state', (_req, res) => {
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
      gameDatabase,
      unfinishedSets,
    );
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
    if (query == null || typeof query !== 'string') {
      res.status(400).send('Query is required');
      return;
    }
    res.send(personDb.search(query));
  });
  app.get('/people/:id', (req, res) => {
    const id = req.params['id'];
    res.send(personDb.getById(id));
  });
  app.get('/games', (_, res) => {
    res.send(gameDatabase.getGames());
  });
  app.get('/matches', (_, res) => {
    res.send(matchList);
  });
  app.post('/incrementScore', incrementScore.bind(null, outputs) as Application);
  app.get('/incrementScore', incrementScore.bind(null, outputs) as Application);

  const httpServer = createServer(app);
  socketServer = new ws.Server({
    server: httpServer,
  });
  socketServer.on('connection', function connection(ws): void {
    ws.send(JSON.stringify(state));
    logger.info('Websocket connection received');
  });

  httpServer.listen(port, () => logger.info(`Listening on port ${port}`));
  return httpServer;
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

function loadOutputs(outputs: OutputConfig[]): Output[] {
  return outputs.map((conf): Output => {
    switch (conf.type) {
      case 'websocket':
        return new WebSocketOutput(conf);
      case 'file':
        return new FileOutput(conf);
      case 'websocketClient':
        return new WebSocketClientOutput(conf);
      case 'httpClient':
        return new HttpClientOutput(conf);
      default:
        throw new Error('Output type not supported');
    }
  });
}

function loadDefaultState(defaultState: Partial<State>): void {
  Object.assign(state, merge(state, defaultState));
}

// TODO: Subscribe to player id?
function updatePeople(list: { person: Person }[]): void {
  list.forEach(x => {
    if (x.person.id == null || x.person.id === '') {
      return;
    }
    const p = personDb.getById(x.person.id);
    if (p == null) {
      return;
    }
    x.person = p;
  });
}

function parseScoreboard(
  form: ScoreboardForm,
  gameDatabase: GameDatabase,
  unfinishedSets: TournamentSet[],
): Scoreboard {
  const match = parseMatch(form.match);
  const game = parseGame(gameDatabase, form.game);
  const set = parseSet(form.set, unfinishedSets);

  const formPlayers = [0, 1].map(i => form.players[i]);
  const playerTeams = formPlayers.map(player => parseTeams(player.teams));
  const parsedPeople = formPlayers.map(parsePerson);
  if (game.id) {
    parsedPeople.forEach((person, i) => {
      const teams = playerTeams[i];
      if (teams && teams.length) {
        person.teams = person.teams || {};
        person.teams[game.id] = teams;
      }
    });
  }
  const people = personDb.saveAll(parsedPeople).people;
  const players = formPlayers.map((player, i): Player => {
    const person = people[i];
    const score = parseNumber(player.score);
    const inLosers = parseBool(player.inLosers);
    const comment = parseString(player.comment);
    return { person, score, inLosers, comment };
  });

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

function playersFromSet(set: TournamentSet): Required<Player>[] {
  // TODO: Handle discrepancies between numbers of players and entrants?
  const updates = set.entrants.map(entrantToPerson.bind(null, personDb));
  const people = personDb.saveAll(updates).people;
  return people.map((person, idx)  => ({
    person,
    score: 0,
    inLosers: set.entrants[idx].inLosers ?? false,
    comment: '',
    teams: [],
  }));
}

function parseLowerThird(form: LowerThirdForm): LowerThird {
  const formPlayers = [0, 1].map(i => form.players[i]);
  const people = personDb.saveAll(formPlayers.map(parsePerson)).people;
  const commentators = people.map(person => ({ person }));
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
    const msg = parseRawString(fields[`messages[${i}]`]);
    if (msg != null) {
      messages[i] = msg;
    }
  }
  return {
    messages,
  };
}

const FORM_MAPPINGS: {
  [P in keyof Person]: (value: PersonForm[P]) => Person[P];
} = {
  id: parseString,
  handle: parseString,
  alias: parseOptionalString,
  prefix: parseNullableString,
  pronouns: parseOptionalString,
  serviceIds: serviceIds => serviceIds
    ? mapValues(serviceIds, id => id || undefined)
    : {},
  location: parseLocation,
};

function parsePerson(form: PersonForm): Person {
  return Object.fromEntries(
    Object.entries(FORM_MAPPINGS)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map(([key, fn]) => [key, fn(form[key as keyof Person] as any)])
  ) as unknown as Person;
}

function parseGame(
  gameDatabase: GameDatabase,
  locator: GameLocator,
): Game {
  const id = parseOptionalString(locator.id);
  if (id) {
    const found = gameDatabase.getGameById(id);
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

function parseRawString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined;
}

function parseOptionalString(value: unknown): string | undefined {
  return (typeof value === 'string' && value.trim()) || undefined;
}

function parseNullableString(value: unknown): string | null {
  return parseOptionalString(value) || null;
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

function parseArray<T>(value: unknown, parser: (x: unknown) => T): T[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return range(value.length).map(i => parser(value[i]));
}

function parseRecord(value: unknown): Record<string, string> | undefined {
  if (!isObject(value)) {
    return undefined;
  }
  const record = Object.fromEntries(
    Object.entries(value).filter(isStringRecordEntry)
  );
  if (Object.keys(record).length === 0) {
    return undefined;
  }
  return record;
}

function parseLocation(value: unknown): Locality | undefined {
  if (value && typeof value !== 'object') {
    return undefined;
  }
  const loc = value as Record<string, unknown>;
  const country = parseOptionalString(loc.country);
  const state = parseOptionalString(loc.state);
  const city = parseOptionalString(loc.city);
  if (!country && !state && !city) {
    return undefined;
  }
  return ({
    country,
    state,
    city,
  });
}

function parseTeams(value: unknown): GameTeam[] | undefined {
  const teams = parseArray(value, parseTeam);
  if (teams.length === 0) {
    return undefined;
  }
  return teams;
}

function parseTeam(value: unknown): GameTeam {
  if (!isObject(value)) {
    return nullGameTeam;
  }

  const characters = parseArray(value['characters'], parseCharacter);
  const options = parseTeamOptions(value['options']);
  return {
    characters,
    options,
  };
}

function parseCharacter(value: unknown): GameCharacter {
  if (!isObject(value)) {
    return nullGameCharacter;
  }

  const id = parseString(value['id']);
  const options = parseTeamOptions(value['options']);
  return {
    id,
    options,
  };
}

function parseTeamOptions(value: unknown): Record<string, string> | undefined {
  const options = filterValues(parseRecord(value), s => !!s);
  return Object.keys(options).length > 0 ? options as Record<string, string> : undefined;
}

function getBracketState(): Promise<BracketState> {
  return fetch(`http://localhost:${BRACKETS_PORT}/state`)
    .then(resp => resp.json());
}

async function incrementScore(outputs: Output[], req: Request, res: Response): Promise<void> {
  logger.debug(`Score increment request received:\n`, req.query);
  if (!req.fields) {
    res.sendStatus(400);
    return;
  }
  const {
    index: indexStr,
    player: playerStr,
    amount: amountStr,
  } = req.query as IncrementScoreParams;
  if (
    (indexStr != null && isNaN(parseInt(indexStr)))
    || (playerStr != null && isNaN(parseInt(playerStr)))
    || (amountStr != null && isNaN(parseInt(amountStr)))
  ) {
    res.sendStatus(400);
    return;
  }
  if (indexStr == null && playerStr == null) {
    res.sendStatus(400);
    return;
  }
  const index = playerStr != null ? parseInt(playerStr) - 1 : parseInt(indexStr as string);
  const amount = amountStr != null ? parseInt(amountStr) : 1;
  if (index < 0 || index >= state.players.length) {
    res.sendStatus(400);
    return;
  }
  const newScore = state.players[index].score + amount;
  Object.assign(
    state,
    updateImmutable(state, {
      players: {
        [index]: {
          score: {
            $set: newScore,
          },
        },
      },
    }),
  );
  res.sendStatus(200);
  broadcastState(state);
  outputs.forEach(o => o.update(state));
}
