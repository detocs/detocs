import { getLogger } from '@util/logger';

import cors from 'cors';
import express from 'express';
import formidable from 'express-formidable';
import { createServer } from 'http';
import isEqual from 'lodash.isequal';
import ws from 'ws';

import Break from '@models/break';
import Game, { nullGame } from '@models/game';
import gameList from '@models/games';
import LowerThird from '@models/lower-third';
import Match, { nullMatch } from '@models/match';
import matchList from '@models/matches';
import * as People from '@models/people';
import Person, { PersonUpdate, getPrefixedName, nullPerson } from '@models/person';
import Player from '@models/player';
import Scoreboard from '@models/scoreboard';
import TournamentSet from '@models/tournament-set';
import { getConfig } from '@util/configuration/config';
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

export default function start(port: number): void {
  loadDatabases();

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
    const scoreboard = parseScoreboard(req.fields, unfinishedSets);
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
    const scoreboard = fillBracketSet(req.fields, unfinishedSets);
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
    const lowerThird = parseLowerThird(req.fields);
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
    res.send(gameList);
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
};

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

function loadDatabases(): void {
  People.loadDatabase();
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
  fields: Record<string, unknown>,
  unfinishedSets: TournamentSet[],
): Scoreboard {
  let players = [];
  for (let i = 0; i < 2; i++) {
    const fieldPrefix = `players[${i}]`;
    const person = parsePerson(fields, fieldPrefix);

    const scoreStr = parseOptionalString(fields, `${fieldPrefix}[score]`);
    const score: number = (scoreStr && parseInt(scoreStr)) || 0;
    const inLosers = parseBool(fields, `${fieldPrefix}[inLosers]`);
    const comment = parseString(fields, `${fieldPrefix}[comment]`);
    players.push({ person, score, inLosers, comment });
  }

  const match = parseMatch(fields);
  const game = parseGame(fields);
  const set = parseSet(fields, unfinishedSets);
  // TODO: Reload people from datastore?

  return {
    players,
    game,
    match,
    set,
  };
}

function fillBracketSet(
  fields: Record<string, unknown>,
  unfinishedSets: TournamentSet[],
): Partial<Scoreboard> {
  const set = parseSet(fields, unfinishedSets);
  if (!set) {
    return {};
  }
  const scoreboard: Partial<Scoreboard> = {};
  scoreboard.players = playersFromSet(set).concat([
    {
      person: nullPerson,
      score: 0,
      inLosers: false,
    },
    {
      person: nullPerson,
      score: 0,
      inLosers: false,
    },
  ]).slice(0, 2);
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
      const participant = entrant.participants[0];

      const foundById = People.getBySmashggId(participant.smashggId);
      if (foundById) {
        return {
          person: foundById,
          score: 0,
          inLosers: entrant.inLosers,
        };
      }

      const foundPeople = People.findByFullName(getPrefixedName(participant));
      if (foundPeople.length == 1) {
        const foundByName = People.save({
          id: foundPeople[0].id,
          smashggId: participant.smashggId,
        });
        return {
          person: foundByName,
          score: 0,
          inLosers: entrant.inLosers,
        };
      }

      const newPerson = People.save(participant);
      return {
        person: newPerson,
        score: 0,
        inLosers: entrant.inLosers,
      };
    } else {
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
  });
}

function parseLowerThird(fields: Record<string, unknown>): LowerThird {
  const commentators = [];
  for (let i = 0; i < 2; i++) {
    const fieldPrefix = `players[${i}]`;
    const person = parsePerson(fields, fieldPrefix);
    commentators.push({ person });
  }
  // TODO: Reload people from datastore?
  return {
    commentators,
    tournament: parseString(fields, 'tournament'),
    event: parseString(fields, 'event'),
  };
}

function parseBreak(fields: Record<string, unknown>): Break {
  const messages = [];
  for (let i = 0; i < 4; i++) {
    const field = `messages[${i}]`;
    const msg = parseOptionalString(fields, field);
    if (msg != null) {
      messages[i] = msg;
    }
  }
  return {
    messages,
  };
}

function parsePerson(fields: Record<string, unknown>, fieldPrefix: string): Person {
  const id = parseId(fields[`${fieldPrefix}[id]`]);
  const update: PersonUpdate = { id };
  const handleOrAlias = fields[`${fieldPrefix}[handleOrAlias]`] as string | undefined;
  if (handleOrAlias != null) {
    update.handle = handleOrAlias.trim();
  }
  const handle = fields[`${fieldPrefix}[handle]`] as string | undefined;
  if (handle != null) {
    update.handle = handle.trim();
  }
  const alias = fields[`${fieldPrefix}[alias]`] as string | undefined;
  if (alias != null) {
    update.alias = alias.trim() || undefined;
  }
  const prefix = fields[`${fieldPrefix}[prefix]`] as string | undefined;
  if (prefix != null) {
    update.prefix = prefix.trim() || null;
  }
  const twitter = fields[`${fieldPrefix}[twitter]`] as string | undefined;
  if (twitter != null) {
    update.twitter = twitter.trim() || undefined;
  }
  return People.save(update);
}

function parseGame(fields: Record<string, unknown>): Game {
  const id = fields['game[id]'];
  if (!(typeof id === 'string')) {
    return nullGame;
  }
  const found = gameList.find(g => g.id === id);
  if (found) {
    return found;
  }
  const name = fields['game[name]'];
  if (!(typeof name === 'string')) {
    return nullGame;
  }
  return Object.assign({}, nullGame, {
    id,
    name,
  });
}

function parseMatch(fields: Record<string, unknown>): Match {
  const id = fields['match[id]'];
  if (!(typeof id === 'string')) {
    return nullMatch;
  }
  const found = matchList.find(m => m.id === id);
  if (found) {
    return found;
  }
  const name = fields['match[name]'];
  if (!(typeof name === 'string')) {
    return nullMatch;
  }
  return {
    id,
    name,
    smashggId: null,
  };
}

function parseSet(
  fields: Record<string, unknown>,
  unfinishedSets: TournamentSet[],
): TournamentSet | undefined {
  const serviceName = fields['set[serviceName]'];
  const id = fields['set[id]'];
  const phaseId = fields['set[phaseId]'];
  if (!serviceName || !id || !phaseId) {
    return;
  }
  const serviceInfo = {
    serviceName,
    id,
    phaseId,
  };
  return unfinishedSets.find(s => isEqual(s.serviceInfo, serviceInfo));
}

function parseId(idStr: unknown): string | undefined {
  if (!(typeof idStr === 'string')) {
    return undefined;
  }
  return idStr || undefined;
}

function parseOptionalString(fields: Record<string, unknown>, name: string): string | undefined {
  return fields[name] as string | undefined;
}

function parseString(fields: Record<string, unknown>, name: string): string {
  return parseOptionalString(fields, name) || '';
}

function parseBool(fields: Record<string, unknown>, name: string): boolean {
  return !!fields[name];
}

function getBracketState(): Promise<BracketState> {
  return fetch(`http://localhost:${BRACKETS_PORT}/state`)
    .then(resp => resp.json());
}
