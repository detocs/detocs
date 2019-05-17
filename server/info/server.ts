import log4js from 'log4js';
const logger = log4js.getLogger('server/info');

import ws from 'ws';
import express from 'express';
import formidable from 'express-formidable';
import { Server } from 'http';
import cors from 'cors';

import uuidv4 from '../../util/uuid';
import * as People from '../../models/people';
import Person, { PersonUpdate } from '../../models/person';
import Scoreboard from '../../models/scoreboard';
import ScoreboardAssistant from './output/scoreboard-assistant';
import LowerThird from '../../models/lower-third';

export default function start(port: number): void {
  const output = new ScoreboardAssistant();
  logger.info('Initializing overlay info server');

  const httpServer = express();
  // TODO: Security?
  httpServer.use(cors());
  httpServer.use(formidable());
  httpServer.post('/scoreboard', (req, res) => {
    const uuid = uuidv4();
    logger.debug(`Scoreboard update ${uuid} received:\n`, req.fields);
    if (req.fields) {
      const scoreboard = parseScoreboard(req.fields);
      output.updateScoreboard(scoreboard);
      res.send({
        'updateId': uuid,
        'scoreboard': scoreboard,
      });
    } else {
      res.sendStatus(400);
    }
  });
  httpServer.post('/lowerthird', (req, res) => {
    const uuid = uuidv4();
    logger.debug(`Lower third update ${uuid} received:\n`, req.fields);
    if (req.fields) {
      const lowerThird = parseLowerThird(req.fields);
      output.updateLowerThird(lowerThird);
      res.send({
        'updateId': uuid,
        'lowerThird': lowerThird,
      });
    } else {
      res.sendStatus(400);
    }
  });
  httpServer.get('/people', (req, res) => {
    const query = req.query['q'];
    if (query == null || typeof query !== 'string' || !query.length) {
      res.sendStatus(400);
      return;
    }
    res.send(People.searchByHandle(query));
  });
  httpServer.get('/people/:id(\\d+)', (req, res) => {
    const id = +req.params['id'];
    res.send(People.getById(id));
  });

  const socketServer = new ws.Server({
    server: httpServer as unknown as Server,
  });
  socketServer.on('connection', function connection(ws): void {
    // TODO: Send current info
    logger.info('Websocket connection received');
  });

  httpServer.listen(port, () => logger.info(`Listening on port ${port}`));
};

function parseScoreboard(fields: Record<string, any>): Scoreboard {
  const players = [];
  for (let i = 0; i < 2; i++) {
    const fieldPrefix = `players[${i}]`;
    const person = parsePerson(fields, fieldPrefix);

    const scoreStr: string | undefined = fields[`${fieldPrefix}[score]`] || 0;
    const score: number = (scoreStr && parseInt(scoreStr)) || 0;
    players.push({ person, score });
  }
  // TODO: Reload people from datastore?
  return {
    players,
    match: fields['match'] as string,
    game: fields['game'] as string,
  };
}

function parseLowerThird(fields: Record<string, any>): LowerThird {
  const commentators = [];
  for (let i = 0; i < 2; i++) {
    const fieldPrefix = `players[${i}]`;
    const person = parsePerson(fields, fieldPrefix);
    commentators.push({ person });
  }
  // TODO: Reload people from datastore?
  return {
    commentators,
    match: fields['match'] as string,
    game: fields['game'] as string,
  };
}

function parsePerson(fields: Record<string, any>, fieldPrefix: string): Person {
  const idStr: string | undefined = fields[`${fieldPrefix}[id]`];
  const id: number | undefined = idStr ? parseInt(idStr) : undefined;
  const update: PersonUpdate = {
    id,
    handle: fields[`${fieldPrefix}[handle]`] as string,
  };
  const prefix: string | null | undefined = fields[`${fieldPrefix}[prefix]`];
  if (prefix != null) {
    update.prefix = prefix;
  }
  const twitter: string | null | undefined = fields[`${fieldPrefix}[twitter]`];
  if (twitter != null) {
    update.twitter = twitter;
  }
  return People.save(update);
}
