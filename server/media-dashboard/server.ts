import log4js from 'log4js';
const logger = log4js.getLogger('server/media-dashboard');
logger.error = logger.error.bind(logger);

import express, { Request, Response } from 'express';
import updateImmutable from 'immutability-helper';
import * as ws from 'ws';

import { appWebsocketServer } from '../../util/http';
import { MediaServer } from '../media/server';

import { State, nullState } from './state';
import { Clip } from '../../models/media';

type WebSocketClient = ws;

export default async function start(port: number, mediaServer: MediaServer): Promise<void> {
  logger.info('Initializing media dashboard server');

  const { appServer, socketServer } = appWebsocketServer(
    port,
    () => logger.info(`Listening on port ${port}`),
  );

  new MediaDashboardServer(appServer, socketServer, mediaServer);
};

class MediaDashboardServer {
  private readonly appServer: express.Express;
  private readonly socketServer: ws.Server;
  private readonly media: MediaServer;
  private state: State = nullState;

  public constructor(
    appServer: express.Express,
    socketServer: ws.Server,
    mediaServer: MediaServer,
  ) {
    this.appServer = appServer;
    this.socketServer = socketServer;
    this.media = mediaServer;
    this.registerHandlers();
  }

  public registerHandlers(): void {
    const clip10 = this.getClip.bind(this, 10);
    this.appServer.post('/clip10', clip10);
    this.appServer.get('/clip10', clip10);
    this.appServer.get('/state', (req, res) => {
      res.send(this.state);
    });

    this.socketServer.on('connection', (client): void => {
      logger.info('Websocket connection received');
      this.sendState(client as WebSocketClient);
    });
  }

  private broadcastState(): void {
    this.socketServer.clients.forEach(client => {
      if (client.readyState === ws.OPEN) {
        this.sendState(client as WebSocketClient);
      }
    });
  }

  private sendState(client: WebSocketClient): void {
    client.send(JSON.stringify(this.state));
  }

  private getClip = async (seconds: number, req: Request, res: Response): Promise<void> => {
    const replay = await this.media.getReplay();
    if (!replay) {
      return;
    }
    console.log(replay, seconds);
    const startOffset = Math.max(0, replay.video.durationMs - seconds * 1000);
    const clip: Clip = {
      video: replay.video,
      waveform: replay.waveform,
      clipEndMs: replay.video.durationMs,
      clipStartMs: startOffset,
      recordingTimestampMs: replay.startMs != null ? replay.startMs + startOffset : undefined,
    };
    console.log(clip);
    this.state = updateImmutable(this.state, { clips: { $push: [ clip ] }});
    this.broadcastState();
  };
}
