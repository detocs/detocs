import log4js from 'log4js';
const logger = log4js.getLogger('server/media-dashboard');
logger.error = logger.error.bind(logger);

import express, { Request, Response } from 'express';
import { promises as fs } from 'fs';
import updateImmutable from 'immutability-helper';
import * as ws from 'ws';

import { VideoClip, ImageClip, isVideoClip } from '../../models/media';
import { tmpDir } from '../../util/fs';
import * as httpUtil from '../../util/http-server';
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

export interface GetClipParams {
  seconds?: string;
}

export interface GetClipResponse {
  id: string;
};

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
    this.appServer.post('/screenshot', this.getScreenshot);
    this.appServer.get('/screenshot', this.getScreenshot);
    this.appServer.post('/clip', this.getClip);
    this.appServer.get('/clip', this.getClip);
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

  private getScreenshot = async (req: Request, res: Response): Promise<void> => {
    let screenshot;
    try {
      screenshot = await this.media.getCurrentFullScreenshot();
    } catch(err) {
      sendServerError(res, `Unable to get screenshot: ${err}`);
      return;
    }
    if (!screenshot) {
      sendServerError(res, 'Unable to get screenshot');
      return;
    }

    const clip: ImageClip = {
      id: uuidv4(),
      media: screenshot.image,
      description: '',
      recordingTimestampMs: screenshot.timestampMs,
    };
    this.state = updateImmutable(this.state, { clips: { $push: [{
      clip,
      status: ClipStatus.Rendered,
    }]}});
    const respBody: GetClipResponse = { id: clip.id };
    res.send(respBody);
    this.broadcastState();
  };

  private getClip = async (req: Request, res: Response): Promise<void> => {
    const { seconds: secondsStr } = req.query as GetClipParams;
    if (typeof secondsStr !== 'string') {
      sendUserError(res, 'Invalid duration');
      return;
    }
    const seconds = +secondsStr;
    if (isNaN(seconds) || seconds < 0) {
      sendUserError(res, 'Invalid duration');
      return;
    }

    let replay;
    try {
      replay = await this.media.getReplay();
    } catch(err) {
      sendServerError(res, `Unable to get replay: ${err}`);
      return;
    }
    if (!replay) {
      sendServerError(res, 'Unable to get replay');
      return;
    }

    const startOffset = Math.max(0, replay.video.durationMs - seconds * 1000);
    const clip: VideoClip = {
      id: uuidv4(),
      media: replay.video,
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
    const respBody: GetClipResponse = { id: clip.id };
    res.send(respBody);
    this.broadcastState();
  };

  private updateClip = async (req: Request, res: Response): Promise<void> => {
    const { update, error } = validateUpdateRequest(req.fields as UpdateRequest);
    if (error != null || !update) {
      sendUserError(res, error);
      return;
    }

    const { id, startMs, endMs, description } = update;
    console.log(id, startMs, endMs, description);
    const { index, clipView } = this.getVideoClipById(id);
    console.log(index, clipView);
    if (clipView == null) {
      sendUserError(res, `No recording matches ID ${id}`);
      return;
    }
    if (endMs > clipView.clip.media.durationMs) {
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

    this.state = updateImmutable(
      this.state as { clips: ClipView<VideoClip>[]},
      { clips: { [index]: { clip: { $merge: {
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
    const { index, clipView: orig } = this.getVideoClipById(id);
    if (orig == null) {
      sendUserError(res, `No recording matches ID ${id}`);
      return;
    }
    if (endMs > orig.clip.media.durationMs) {
      sendUserError(res, 'Invalid bounds');
      return;
    }

    this.state = updateImmutable(
      this.state as { clips: ClipView<VideoClip>[]},
      { clips: { [index]: { 
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
      orig.clip.media,
      orig.clip.clipStartMs,
      orig.clip.clipEndMs,
      orig.clip.id + '.mp4',
    )
      .then(video => {
        console.log(video);
        const { index, clipView: cv } = this.getVideoClipById(orig.clip.id);
        if (cv == null) {
          sendUserError(res, `Clip ${orig.clip.id} deleted while cutting`);
          return;
        }
        this.state = updateImmutable(
          this.state as { clips: ClipView<VideoClip>[]},
          { clips: { [index]: { 
            $merge: {
              status: ClipStatus.Rendered,
            },
            clip: { $merge: {
              media: video,
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
        const { index, clipView } = this.getVideoClipById(orig.clip.id);
        if (clipView) {
          this.state = updateImmutable(this.state, { clips: { [index]: { $merge: {
            status: ClipStatus.Uncut,
          }}}});
          this.broadcastState();
        }
        sendServerError(res, e);
      });
  };

  private getVideoClipById(id: string): {
    index: number;
    clipView: ClipView<VideoClip> | undefined;
  } {
    const index = this.state.clips
      .findIndex(cv => isVideoClip(cv.clip) && cv.clip.id === id);
    const cv = index === -1 ?
      undefined :
      this.state.clips[index];
    return { index, clipView: cv as ClipView<VideoClip> | undefined };
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
