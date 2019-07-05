import log4js from 'log4js';
const logger = log4js.getLogger('server/info');

import ws from 'ws';
import express from 'express';
import formidable from 'express-formidable';
import { createServer } from 'http';
import cors from 'cors';

import ScoreboardAssistant from './output/scoreboard-assistant';
import Game, { nullGame } from '../../models/game';
import gameList from '../../models/games';
import LowerThird from '../../models/lower-third';
import Match, { nullMatch } from '../../models/match';
import matchList from '../../models/matches';
import * as People from '../../models/people';
import Person, { PersonUpdate } from '../../models/person';
import Scoreboard from '../../models/scoreboard';
import uuidv4 from '../../util/uuid';

import State from './state';

const state: State = {
  players: [],
  match: nullMatch,
  game: nullGame,
  commentators: [],
  tournament: '',
  event: '',
};

export default function start(port: number): void {
  loadDatabases();

  const output = new ScoreboardAssistant();
  logger.info('Initializing overlay info server');

  const app = express();
  // TODO: Security?
  app.use(cors());
  app.use(formidable());
  app.get('/state', (req, res) => {
    res.send(state);
  });
  app.post('/scoreboard', (req, res) => {
    const uuid = uuidv4();
    logger.debug(`Scoreboard update ${uuid} received:\n`, req.fields);
    if (req.fields) {
      const scoreboard = parseScoreboard(req.fields);
      Object.assign(state, scoreboard);
      output.updateScoreboard(state);
      res.send({
        'updateId': uuid,
        'scoreboard': scoreboard,
      });
    } else {
      res.sendStatus(400);
    }
  });
  app.post('/lowerthird', (req, res) => {
    const uuid = uuidv4();
    logger.debug(`Lower third update ${uuid} received:\n`, req.fields);
    if (req.fields) {
      const lowerThird = parseLowerThird(req.fields);
      Object.assign(state, lowerThird);
      output.updateLowerThird(state);
      res.send({
        'updateId': uuid,
        'lowerThird': lowerThird,
      });
    } else {
      res.sendStatus(400);
    }
  });
  app.get('/people', (req, res) => {
    const query = req.query['q'];
    if (query == null || typeof query !== 'string' || !query.length) {
      res.sendStatus(400);
      return;
    }
    res.send(People.searchByHandle(query));
  });
  app.get('/people/:id(\\d+)', (req, res) => {
    const id = +req.params['id'];
    res.send(People.getById(id));
  });
  app.get('/games', (_, res) => {
    res.send(gameList);
  });
  app.get('/matches', (_, res) => {
    res.send(matchList);
  });

  const httpServer = createServer(app);
  const socketServer = new ws.Server({
    server: httpServer,
  });
  socketServer.on('connection', function connection(ws): void {
    ws.send(JSON.stringify(state));
    logger.info('Websocket connection received');
  });

  httpServer.listen(port, () => logger.info(`Listening on port ${port}`));
};

function loadDatabases(): void {
  People.loadDatabase();
}

function parseScoreboard(fields: Record<string, unknown>): Scoreboard {
  const players = [];
  for (let i = 0; i < 2; i++) {
    const fieldPrefix = `players[${i}]`;
    const person = parsePerson(fields, fieldPrefix);

    const scoreStr = parseOptionalString(fields, `${fieldPrefix}[score]`);
    const score: number = (scoreStr && parseInt(scoreStr)) || 0;
    const inLosers = parseBool(fields, `${fieldPrefix}[inLosers]`);
    const comment = parseString(fields, `${fieldPrefix}[comment]`);
    players.push({ person, score, inLosers, comment });
  }
  // TODO: Reload people from datastore?

  return {
    players,
    game: parseGame(fields),
    match: parseMatch(fields),
  };
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

function parsePerson(fields: Record<string, unknown>, fieldPrefix: string): Person {
  const id: number | undefined = parseId(fields[`${fieldPrefix}[id]`]);
  const update: PersonUpdate = {
    id,
    handle: fields[`${fieldPrefix}[handle]`] as string,
  };
  const prefix = fields[`${fieldPrefix}[prefix]`] as string | null | undefined;
  if (prefix != null) {
    update.prefix = prefix;
  }
  const twitter = fields[`${fieldPrefix}[twitter]`] as string | null | undefined;
  if (twitter != null) {
    update.twitter = twitter;
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
  return {
    id,
    name,
    shortNames: [],
    hashtags: [],
  };
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

function parseId(idStr: unknown): number | undefined {
  if (!(typeof idStr === 'string')) {
    return undefined;
  }
  return idStr ? parseInt(idStr) : undefined;
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
