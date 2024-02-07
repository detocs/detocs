import cors from 'cors';
import express from 'express';
import formidable from 'express-formidable';
import { createServer } from 'http';
import * as ws from 'ws';

import { Logger, LoggerFunction } from '@util/logger';

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

export interface HttpError {
  send(logger: Logger, res: express.Response): void;
  log(logger: Logger): void;
}

export function userError(errOrStr?: Error | string, cause?: Error): HttpError {
  return ({
    send(logger: Logger, res: express.Response): void {
      sendUserError(logger, res, errOrStr, cause);
    },
    log(logger: Logger): void {
      logger.warn(errOrStr ?? '', cause ?? '');
    },
  });
}

export function serverError(errOrStr?: Error | string, cause?: Error): HttpError {
  return ({
    send(logger: Logger, res: express.Response): void {
      sendServerError(logger, res, errOrStr, cause);
    },
    log(logger: Logger): void {
      logger.error(errOrStr ?? '', cause ?? '');
    },
  });
}

export function sendUserError(
  logger: Logger,
  res: express.Response,
  errOrStr?: Error | string,
  cause?: Error,
): void {
  send(logger.warn, res, 400, errOrStr, cause);
}

export function sendServerError(
  logger: Logger,
  res: express.Response,
  errOrStr?: Error | string,
  cause?: Error,
): void {
  send(logger.error, res, 500, errOrStr, cause);
}

function send(
  loggerFn: LoggerFunction,
  res: express.Response,
  status: number,
  errOrStr?: Error | string,
  cause?: Error,
): void {
  if (cause) {
    loggerFn(cause);
    res.status(status).send(`${errOrStr} ${cause.message || cause.toString()}`);
  } else if (errOrStr) {
    const msg = errOrStr instanceof Error ? errOrStr.message : errOrStr;
    loggerFn(errOrStr);
    res.status(status).send(msg);
  } else {
    res.sendStatus(status);
  }
}
