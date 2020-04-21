import cors from 'cors';
import express from 'express';
import formidable from 'express-formidable';
import { createServer } from 'http';
import * as ws from 'ws';

interface Logger {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

export function appWebsocketServer(
  port: number,
  onStart: () => void,
): { appServer: express.Express; socketServer: ws.Server } {
  const appServer = express();
  // TODO: Security?
  appServer.use(cors());
  appServer.use(formidable());

  const httpServer = createServer(appServer);
  const socketServer = new ws.Server({
    server: httpServer,
  });

  httpServer.listen(port, onStart);

  return { appServer, socketServer };
}

export function sendUserError(logger: Logger, res: express.Response, msg?: string): void {
  if (msg) {
    logger.warn(msg);
    res.status(400).send(msg);
  } else {
    res.sendStatus(400);
  }
}

export function sendServerError(logger: Logger, res: express.Response, msg?: string): void {
  if (msg) {
    logger.error(msg);
    res.status(500).send(msg);
  } else {
    res.sendStatus(500);
  }
}
