import cors from 'cors';
import express from 'express';
import formidable from 'express-formidable';
import { createServer } from 'http';
import * as ws from 'ws';

interface LoggerMethod {
  (msg: unknown, ...args: unknown[]): void;
}

interface Logger {
  debug: LoggerMethod;
  info: LoggerMethod;
  warn: LoggerMethod;
  error: LoggerMethod;
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

export function sendUserError(logger: Logger, res: express.Response, err?: Error | string): void {
  send(logger.warn, res, 400, err);
}

export function sendServerError(logger: Logger, res: express.Response, err?: Error | string): void {
  send(logger.error, res, 500, err);
}

function send(
  loggerFn: LoggerMethod,
  res: express.Response,
  status: number,
  err?: Error | string,
): void {
  if (err) {
    const msg = err instanceof Error ? err.message : err;
    loggerFn(err);
    res.status(status).send(msg);
  } else {
    res.sendStatus(status);
  }
}
