import log4js from 'log4js';
const logger = log4js.getLogger('server/media-dashboard');
logger.error = logger.error.bind(logger);

import express, { Request, Response } from 'express';
import filenamify from 'filenamify';
import { promises as fs } from 'fs';
import updateImmutable from 'immutability-helper';
import { Result, ok, err } from 'neverthrow';
import path from 'path';
import * as ws from 'ws';

import { VideoClip, ImageClip, isVideoClip, VideoFile, ImageFile, Clip } from '../../models/media';
import { getConfig } from '../../util/config';
import * as httpUtil from '../../util/http-server';
import { getId } from '../../util/id';

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

const sendUserError = httpUtil.sendUserError.bind(null, logger);
const sendServerError = httpUtil.sendServerError.bind(null, logger);

export default async function start(port: number, mediaServer: MediaServer): Promise<void> {
  logger.info('Initializing media dashboard server');

  const { appServer, socketServer } = httpUtil.appWebsocketServer(
    port,
    () => logger.info(`Listening on port ${port}`),
  );

  const dir = getConfig().clipDirectory;
  await fs.mkdir(dir, { recursive: true });

  new ClipServer(appServer, socketServer, mediaServer, dir);
};

class ClipServer {
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

  private broadcastState = (): void => {
    this.socketServer.clients.forEach(client => {
      if (client.readyState === ws.OPEN) {
        this.sendState(client as WebSocketClient);
      }
    });
  };

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
      id: getId(),
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
      sendServerError(res, `Unable to get replay: ${err.toString()}`);
      return;
    }
    if (!replay) {
      sendServerError(res, 'Unable to get replay');
      return;
    }

    const startOffset = Math.max(0, replay.video.durationMs - seconds * 1000);
    const clip: VideoClip = {
      id: getId(),
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
    return this.updateVideoClip(req.fields as UpdateRequest, ClipStatus.Uncut)
      .match(
        () => {
          res.sendStatus(200);
        },
        err => sendUserError(res, err),
      );
  };

  private cutClip = async (req: Request, res: Response): Promise<void> => {
    return this.updateVideoClip(req.fields as UpdateRequest, ClipStatus.Rendering)
      .match(
        async clipView => {
          const clipId = clipView.clip.id;
          await this.media.cutVideo(
            clipView.clip.media,
            clipView.clip.clipStartMs,
            clipView.clip.clipEndMs,
            clipView.clip.id + '.mp4',
          )
            .then(async video => {
              const err = this.setClipAsRendered(clipId, video);
              if (err) {
                sendServerError(res, `Clip ${clipId} deleted while cutting`);
                return;
              }
              this.media.getVideoWaveform(video)
                .then(waveform => this.setClipWaveform(clipId, waveform))
                .then(err => err && logger.error(err))
                .catch(logger.error);
              this.copyClipToStorage(clipId)
                .then(err => err && logger.error(err))
                .catch(logger.error);
              res.sendStatus(200);
              this.broadcastState();
            })
            .catch(e => {
              // Reset status
              this.resetClipStatus(clipId);
              sendServerError(res, e);
              this.broadcastState();
            });
        },
        err => Promise.resolve(sendUserError(res, err)),
      );
  };

  private async copyClipToStorage(id: string): Promise<Error | null> {
    const { clipView: cv } = this.getClipById(id);
    if (cv == null) {
      return new Error(`Clip ${id} deleted?`);
    }
    fs.copyFile(
      this.media.getFullPath(cv.clip.media.filename),
      path.join(this.storageDir, clipStorageFilename(cv.clip)));
    return null;
  }

  private updateVideoClip(
    data: UpdateRequest,
    status: ClipStatus,
  ): Result<ClipView<VideoClip>, Error> {
    return validateUpdateRequest(data).andThen(update => {
      const { id, startMs, endMs, description } = update;
      const { index, clipView } = this.getVideoClipById(id);
      if (clipView == null) {
        return err(new Error(`No recording matches ID ${id}`));
      }
      if (endMs > clipView.clip.media.durationMs) {
        return err(new Error('Invalid bounds'));
      }

      if (startMs === clipView.clip.clipStartMs &&
        endMs === clipView.clip.clipEndMs &&
        description === clipView.clip.description
      ) {
        return ok(clipView);
      }

      this.state = updateImmutable(
        this.state as { clips: ClipView<VideoClip>[]},
        { clips: { [index]: { 
          $merge: {
            status,
          },
          clip: { $merge: {
            clipStartMs: startMs,
            clipEndMs: endMs,
            description,
          }},
        }}});
      this.broadcastState();
      return ok(this.state.clips[index] as ClipView<VideoClip>);
    });
  }

  private setClipAsRendered(id: string, video: VideoFile): Error | void {
    const { index, clipView: cv } = this.getVideoClipById(id);
    if (cv == null) {
      return new Error(`Clip ${id} deleted while cutting`);
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
            cv.clip.recordingTimestampMs + cv.clip.clipStartMs,
          streamTimestampMs: cv.clip.streamTimestampMs &&
            cv.clip.streamTimestampMs + cv.clip.clipStartMs,
        }},
      }}});
    this.broadcastState();
  }

  private setClipWaveform(id: string, waveform: ImageFile): Error | void {
    const { index, clipView: cv } = this.getVideoClipById(id);
    if (cv == null) {
      return new Error(`Clip ${id} deleted while generating waveform`);
    }
    this.state = updateImmutable(
      this.state as { clips: ClipView<VideoClip>[]},
      { clips: { [index]: { clip: { $merge: {
        waveform
      }}}}});
    this.broadcastState();
  }

  private resetClipStatus(id: string): void {
    const { index, clipView } = this.getVideoClipById(id);
    if (!clipView) {
      return;
    }
    this.state = updateImmutable(this.state, { clips: { [index]: { $merge: {
      status: ClipStatus.Uncut,
    }}}});
    this.broadcastState();
  }

  private getClipById(id: string): {
    index: number;
    clipView: ClipView | undefined;
  } {
    const index = this.state.clips
      .findIndex(cv => cv.clip.id === id);
    const cv = index === -1 ?
      undefined :
      this.state.clips[index];
    return { index, clipView: cv };
  }

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

function clipStorageFilename(clip: Clip): string {
  return `${clip.media.filename}${clip.description ? '_' + filenamify(clip.description) : ''}`;
}

function validateUpdateRequest(req: UpdateRequest): Result<ClipUpdate, Error> {
  const { id, startMs: startStr, endMs: endStr, description } = req as UpdateRequest;
  const startMs = startStr != null ? parseInt(startStr) : NaN;
  const endMs = endStr != null ? parseInt(endStr) : NaN;
  if (!id) {
    return err(new Error('id is required'));
  }
  if (isNaN(startMs) || isNaN(endMs) || startMs < 0 || startMs >= endMs) {
    return err(new Error('Invalid bounds'));
  }
  return ok({ id, startMs, endMs, description: description || '' });
}
