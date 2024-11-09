import express, { Request, Response } from 'express';

import * as httpUtil from '@util/http-server';
import { getLogger } from '@util/logger';

interface ErrorReportRequest {
  message?: string;
  stack?: string;
}

const logger = getLogger('server/errors');
const errorLogger = getLogger('frontend');
const sendUserError = httpUtil.sendUserError.bind(null, logger);

export default function start({ port }: { port: number; }): void {
  logger.info('Initializing error reporter server');

  const { appServer } = httpUtil.appWebsocketServer(
    port,
    () => logger.info(`Listening on port ${port}`),
  );

  const server = new ErrorServer(appServer);
  server.registerHandlers();
}

class ErrorServer {
  private readonly appServer: express.Express;

  public constructor(
    appServer: express.Express,
  ) {
    this.appServer = appServer;
  }

  public registerHandlers(): void {
    this.appServer.post('/report', this.reportError);
  }

  private reportError = async (req: Request, res: Response): Promise<void> => {
    if (!req.fields) {
      res.sendStatus(400);
      return;
    }
    const { message } = req.fields as ErrorReportRequest;
    if (!message) {
      sendUserError(res, 'Error message is required');
      return;
    }

    errorLogger.error(req.fields);
    res.sendStatus(200);
  };
}
