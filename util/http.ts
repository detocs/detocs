import cors from 'cors';
import express from 'express';
import formidable from 'express-formidable';
import { createServer } from 'http';
import * as ws from 'ws';

export async function checkResponseStatus(resp: void | Response): Promise<Response> {
  if (!resp) {
    throw new Error();
  }
  if (!resp.ok) {
    throw new Error(`${resp.status}: ${resp.statusText}\n${await resp.text()}`);
  }
  return resp;
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
