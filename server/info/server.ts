import log4js from 'log4js';
const logger = log4js.getLogger('server/info');

import ws from 'ws';
import express from 'express';
import formidable from 'express-formidable';
import { createServer } from 'http';
import cors from 'cors';

import Game, { nullGame } from '../../models/game';
import gameList from '../../models/games';
import LowerThird from '../../models/lower-third';
import Match, { nullMatch } from '../../models/match';
import matchList from '../../models/matches';
import * as People from '../../models/people';
import Person, { PersonUpdate } from '../../models/person';
import Scoreboard from '../../models/scoreboard';
import TournamentSet from '../../models/tournament-set';
import SmashggClient from '../../util/smashgg';

import ScoreboardAssistant from './output/scoreboard-assistant';
import State, { nullState } from './state';

const state: State = Object.assign({}, nullState);
let socketServer: ws.Server | null = null;

export default function start(port: number): void {
  loadDatabases();

  const output = new ScoreboardAssistant();
  logger.info('Initializing overlay info server');

  const smashgg = new SmashggClient();
  setInterval(fetchSets, 5 * 60 * 1000, smashgg);

  const app = express();
  // TODO: Security?
  app.use(cors());
  app.use(formidable());
  app.get('/state', (req, res) => {
    res.send(state);
  });
  app.post('/scoreboard', (req, res) => {
    logger.debug(`Scoreboard update received:\n`, req.fields);
    if (!req.fields) {
      res.sendStatus(400);
      return;
    }
    const scoreboard = parseScoreboard(req.fields);
    updatePeople(state.commentators);
    const phaseChanged = scoreboard.phaseId != state.phaseId;
    Object.assign(state, scoreboard);
    if (phaseChanged) {
      fetchSets(smashgg);
    }
    res.sendStatus(200);
    broadcastState(state);
    output.updateScoreboard(state);
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
    output.updateLowerThird(state);
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

// TODO: Subscribe to player id?
function updatePeople(list: { person: Person }[]): void {
  list.forEach(x => {
    if (x.person.id == null || x.person.id < 0) {
      return;
    }
    const p = People.getById(x.person.id);
    if (p == null) {
      return;
    }
    x.person = p;
  });
}

async function fetchSets(smashgg: SmashggClient): Promise<void> {
  if (!state.phaseId) {
    state.unfinishedSets = [];
    return;
  }
  logger.debug(`Fetching sets for phase ${state.phaseId}`);
  state.unfinishedSets = await smashgg.upcomingSetsByPhase(state.phaseId);
  broadcastState(state);
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
    phaseId: parseOptionalString(fields, 'phaseId'),
    set: parseSet(fields),
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
  if (twitter != null && twitter.length) {
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

function parseSet(fields: Record<string, unknown>): TournamentSet | undefined {
  const setId = fields['set'];
  if (!setId || !state.unfinishedSets) {
    return;
  }
  return state.unfinishedSets.find(s => s.id === setId);
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
