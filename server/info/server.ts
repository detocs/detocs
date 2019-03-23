import log4js from 'log4js';
const logger = log4js.getLogger('server/info');

import ws from 'ws';
import express from 'express';
import formidable from 'express-formidable';
import { Server } from 'http';
import cors from 'cors';

import uuidv4 from '../../util/uuid';
import ScoreboardAssistant from './output/scoreboard-assistant';

export default function start(port: number) {
  const output = new ScoreboardAssistant();
  logger.info('Initializing overlay info server');

  const httpServer = express();
  // TODO: Security?
  httpServer.use(cors());
  httpServer.use(formidable());
  httpServer.post('/match', (req, res) => {
    const uuid = uuidv4();
    logger.debug(`Match update ${uuid} received:\n`, req.fields);
    if (req.fields) {
      output.match(parseBody(req.fields))
      res.send({ 'updateId': uuid });
    } else {
      res.sendStatus(400);
    }
  })

  const socketServer = new ws.Server({
    server: httpServer as unknown as Server,
  });
  socketServer.on('connection', function connection(ws) {
    // TODO: Send current info
    logger.info('Websocket connection received');
  });

  httpServer.listen(port, () => logger.info(`Listening on port ${port}`));
};

function parseBody(fields: Record<string, any>) {
  return {
    players: [
      {
        person: {
          handle: fields['players[0][handle]'] as string,
          sponsor: fields['players[0][sponsor]'] as string,
        },
        score: fields['players[0][score]'] as number,
      },
      {
        person: {
          handle: fields['players[1][handle]'] as string,
          sponsor: fields['players[1][sponsor]'] as string,
        },
        score: fields['players[1][score]'] as number,
      },
    ]
  };
}
