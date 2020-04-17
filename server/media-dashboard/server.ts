import log4js from 'log4js';
const logger = log4js.getLogger('server/media-dashboard');
logger.error = logger.error.bind(logger);

import express, { Request, Response } from 'express';
import { promises as fs } from 'fs';
import updateImmutable from 'immutability-helper';
import * as ws from 'ws';

import { Clip } from '../../models/media';
import { tmpDir } from '../../util/fs';
import * as httpUtil from '../../util/http';
import uuidv4 from '../../util/uuid';

import { MediaServer } from '../media/server';

import { State, nullState, ClipView, ClipStatus } from './state';

interface UpdateRequest {
  id?: string;
  startMs?: string;
  endMs?: string;
  description?: string;
}

interface ClipUpdate {
  id: string;
  startMs: number;
  endMs: number;
  description: string;
}

type WebSocketClient = ws;

const TEMP_DIR_NAME = 'clips';
const sendUserError = httpUtil.sendUserError.bind(null, logger);
const sendServerError = httpUtil.sendServerError.bind(null, logger);

export default async function start(port: number, mediaServer: MediaServer): Promise<void> {
  logger.info('Initializing media dashboard server');

  const { appServer, socketServer } = httpUtil.appWebsocketServer(
    port,
    () => logger.info(`Listening on port ${port}`),
  );

  // TODO: override with config
  const dir = tmpDir(TEMP_DIR_NAME);
  await fs.mkdir(dir, { recursive: true });

  new MediaDashboardServer(appServer, socketServer, mediaServer, dir);
};

class MediaDashboardServer {
  private readonly appServer: express.Express;
  private readonly socketServer: ws.Server;
  private readonly media: MediaServer;
  private readonly storageDir: string;
  private state: State = nullState;

  public constructor(
    appServer: express.Express,
    socketServer: ws.Server,
    mediaServer: MediaServer,
    storageDir: string,
  ) {
    this.appServer = appServer;
    this.socketServer = socketServer;
    this.media = mediaServer;
    this.storageDir = storageDir;
    this.registerHandlers();
  }

  public registerHandlers(): void {
    const clip10 = this.getClip.bind(this, 10);
    this.appServer.post('/clip10', clip10);
    this.appServer.get('/clip10', clip10);
    this.appServer.post('/update', this.updateClip);
    this.appServer.post('/cut', this.cutClip);
    this.appServer.get('/state', (_, res) => {
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
    const startOffset = Math.max(0, replay.video.durationMs - seconds * 1000);
    const clip: Clip = {
      id: uuidv4(),
      video: replay.video,
      waveform: replay.waveform,
      clipEndMs: replay.video.durationMs,
      clipStartMs: startOffset,
      description: '',
      recordingTimestampMs: replay.startMs != null ? replay.startMs + startOffset : undefined,
    };
    this.state = updateImmutable(this.state, { clips: { $push: [{
      clip,
      status: ClipStatus.Uncut,
    }]}});
    res.sendStatus(200);
    this.broadcastState();
  };

  private updateClip = async (req: Request, res: Response): Promise<void> => {
    const { update, error } = validateUpdateRequest(req.fields as UpdateRequest);
    if (error != null || !update) {
      sendUserError(res, error);
      return;
    }

    const { id, startMs, endMs, description } = update;
    const { index, clipView } = this.getClipById(id);
    if (clipView == null) {
      sendUserError(res, `No recording matches ID ${id}`);
      return;
    }
    if (endMs > clipView.clip.video.durationMs) {
      sendUserError(res, 'Invalid bounds');
      return;
    }

    if (startMs === clipView.clip.clipStartMs &&
      endMs === clipView.clip.clipEndMs &&
      description === clipView.clip.description
    ) {
      res.sendStatus(200);
      return;
    }

    this.state = updateImmutable(this.state, { clips: { [index]: { clip: { $merge: {
      clipStartMs: startMs,
      clipEndMs: endMs,
      description,
    }}}}});
    res.sendStatus(200);
    this.broadcastState();
  };

  private cutClip = async (req: Request, res: Response): Promise<void> => {
    const { update, error } = validateUpdateRequest(req.fields as UpdateRequest);
    if (error != null || !update) {
      sendUserError(res, error);
      return;
    }

    const { id, startMs, endMs, description } = update;
    const { index, clipView: orig } = this.getClipById(id);
    if (orig == null) {
      sendUserError(res, `No recording matches ID ${id}`);
      return;
    }
    if (endMs > orig.clip.video.durationMs) {
      sendUserError(res, 'Invalid bounds');
      return;
    }

    this.state = updateImmutable(this.state, { clips: { [index]: { 
      $merge: {
        status: ClipStatus.Rendering,
      },
      clip: { $merge: {
        clipStartMs: startMs,
        clipEndMs: endMs,
        description,
      }},
    }}});
    this.broadcastState();

    // TODO: Limit resolution?
    // TODO: Update waveform?
    console.log(orig.clip.id);
    return this.media.cutVideo(
      orig.clip.video,
      orig.clip.clipStartMs,
      orig.clip.clipEndMs,
      orig.clip.id + '.mp4',
    )
      .then(video => {
        console.log(video);
        const { index, clipView: cv } = this.getClipById(orig.clip.id);
        if (cv == null) {
          sendUserError(res, `Clip ${orig.clip.id} deleted while cutting`);
          return;
        }
        this.state = updateImmutable(this.state, { clips: { [index]: { 
          $merge: {
            status: ClipStatus.Rendered,
          },
          clip: { $merge: {
            video,
            clipStartMs: 0,
            clipEndMs: video.durationMs,
            recordingTimestampMs: cv.clip.recordingTimestampMs &&
              cv.clip.recordingTimestampMs + orig.clip.clipStartMs,
            streamTimestampMs: cv.clip.streamTimestampMs &&
              cv.clip.streamTimestampMs + orig.clip.clipStartMs,
          }},
        }}});
        res.sendStatus(200);
        this.broadcastState();
      })
      .catch(e => {
        const { index, clipView } = this.getClipById(orig.clip.id);
        if (clipView) {
          this.state = updateImmutable(this.state, { clips: { [index]: { $merge: {
            status: ClipStatus.Uncut,
          }}}});
          this.broadcastState();
        }
        sendServerError(res, e);
      });
  };

  private getClipById(id: string): { index: number; clipView: ClipView | undefined } {
    const index = this.state.clips.findIndex(c => c.clip.id === id);
    const clip = index === -1 ?
      undefined :
      this.state.clips[index];
    return { index, clipView: clip };
  }
}

function validateUpdateRequest(req: UpdateRequest): { update?: ClipUpdate; error?: string } {
  const { id, startMs: startStr, endMs: endStr, description } = req as UpdateRequest;
  const startMs = startStr != null ? parseInt(startStr) : NaN;
  const endMs = endStr != null ? parseInt(endStr) : NaN;
  if (!id || isNaN(startMs) || isNaN(endMs)) {
    return { error: '' };
  }
  if (startMs < 0 || startMs >= endMs) {
    return { error: 'Invalid bounds' };
  }
  return {
    update: { id, startMs, endMs, description: description || '' }
  };
}
