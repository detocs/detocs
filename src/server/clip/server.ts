import { getLogger } from '@util/logger';

import express, { Request, Response } from 'express';
import filenamify from 'filenamify';
import { promises as fs } from 'fs';
import updateImmutable from 'immutability-helper';
import { Result, ok, err } from 'neverthrow';
import path from 'path';
import * as ws from 'ws';

import { VideoClip, ImageClip, isVideoClip, VideoFile, ImageFile, Clip } from '@models/media';
import { getConfig } from '@util/configuration/config';
import * as httpUtil from '@util/http-server';
import { getId } from '@util/id';

import { MediaServer } from '@server/media/server';

import { State, nullState, ClipView, ClipStatus } from './state';
import VisionMixer, { Scene, VideoInput } from '@services/vision-mixer-service';
import isEqual from 'lodash.isequal';

interface SendParams {
  id: string;
  sourceName: string;
}

type SendRequest = Partial<SendParams>;

interface UpdateRequest {
  id?: string;
  startMs?: string;
  endMs?: string;
  description?: string;
}

interface DeleteRequest {
  id?: string;
}

interface ClipUpdate {
  id: string;
  startMs: number;
  endMs: number;
  description: string;
}

export interface GetScreenshotParams {
  sceneName?: string;
}

export interface GetClipParams {
  seconds?: string;
}

export interface GetClipResponse {
  id: string;
}

type WebSocketClient = ws;

type AssumeClipType<T extends Clip> = Omit<State, 'clips'> & {
  clips: ClipView<T>[];
};

const logger = getLogger('server/clip');
const sendUserError = httpUtil.sendUserError.bind(null, logger);
const sendServerError = httpUtil.sendServerError.bind(null, logger);

export default async function start({
  port,
  mediaServer,
  visionMixer,
}: {
  port: number,
  mediaServer: MediaServer,
  visionMixer: VisionMixer,
}): Promise<void> {
  logger.info('Initializing media dashboard server');

  const { appServer, socketServer } = httpUtil.appWebsocketServer(
    port,
    () => logger.info(`Listening on port ${port}`),
  );

  const dir = getConfig().clipDirectory;
  await fs.mkdir(dir, { recursive: true });

  new ClipServer(appServer, socketServer, mediaServer, visionMixer, dir);
}

class ClipServer {
  private readonly appServer: express.Express;
  private readonly socketServer: ws.Server;
  private readonly media: MediaServer;
  private readonly visionMixer: VisionMixer;
  private readonly storageDir: string;
  private state: State = nullState;

  public constructor(
    appServer: express.Express,
    socketServer: ws.Server,
    mediaServer: MediaServer,
    visionMixer: VisionMixer,
    storageDir: string,
  ) {
    this.appServer = appServer;
    this.socketServer = socketServer;
    this.media = mediaServer;
    this.visionMixer = visionMixer;
    this.storageDir = storageDir;
    this.registerHandlers();
    this.getScenes();
    this.getMediaSources();
  }

  public registerHandlers(): void {
    // TODO: RESTify URLs
    this.appServer.post('/screenshot', this.getScreenshot);
    this.appServer.get('/screenshot', this.getScreenshot);
    this.appServer.post('/clip', this.getClip);
    this.appServer.get('/clip', this.getClip);
    this.appServer.post('/update', this.updateClip);
    this.appServer.delete('/delete', this.deleteClip);
    this.appServer.post('/cut', this.cutClip);
    this.appServer.post('/send', this.sendClip);
    this.appServer.get('/state', (_, res) => {
      res.send(this.state);
    });

    this.socketServer.on('connection', (client): void => {
      logger.info('Websocket connection received');
      this.sendState(client as WebSocketClient);
    });
  }

  public getScenes(): void {
    const update = (scenes: Scene[]): void => {
      const newScenes = scenes.map(i => i.name);
      if (isEqual(new Set(newScenes), new Set(this.state.scenes))) {
        return;
      }
      this.state = updateImmutable(
        this.state,
        { scenes: { $set: newScenes } },
      );
      this.broadcastState();
    };
    this.visionMixer.getSceneList().match(update, logger.error);
    this.visionMixer.onSceneListUpdate(update);
  }

  public getMediaSources(): void {
    const update = (inputs: VideoInput[]): void => {
      const newSources = inputs.map(i => i.name);
      if (isEqual(new Set(newSources), new Set(this.state.visionMixer.mediaSources))) {
        return;
      }
      this.state = updateImmutable(
        this.state,
        { visionMixer: { mediaSources: { $set: newSources } } },
      );
      this.broadcastState();
    };
    this.state = updateImmutable(
      this.state,
      { visionMixer: { name: { $set: this.visionMixer.name() } } },
    );
    this.visionMixer.getVideoInputList().match(update, logger.error);
    this.visionMixer.onVideoInputListUpdate(update);
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
    const { sceneName } = req.fields as GetScreenshotParams;
    let screenshot;
    try {
      screenshot = sceneName
        ? await this.media.getSceneFullScreenshot(sceneName)
        : await this.media.getCurrentFullScreenshot();
    } catch(err) {
      sendServerError(res, 'Unable to get screenshot:', err as Error);
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
      recordingTimestampMs: screenshot.recordingTimestampMs,
      streamTimestampMs: screenshot.streamTimestampMs,
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

    const replayResult = await this.media.getReplay();
    if (replayResult.isErr()) {
      sendServerError(res, 'Unable to get replay:', replayResult.error);
      return;
    }
    const replay = replayResult.value;

    const startOffset = Math.max(0, replay.video.durationMs - seconds * 1000);
    const clip: VideoClip = {
      id: getId(),
      media: replay.video,
      waveform: replay.waveform,
      thumbnail: replay.thumbnail,
      clipEndMs: replay.video.durationMs,
      clipStartMs: startOffset,
      description: '',
      recordingTimestampMs: replay.recordingTimestampMs,
      streamTimestampMs: replay.streamTimestampMs,
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

  private deleteClip = async (req: Request, res: Response): Promise<void> => {
    return this.deleteMediaClip(req.fields as DeleteRequest)
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
              this.media.getVideoThumbnail(video)
                .match(
                  thumbnail => this.setClipThumbnail(clipId, thumbnail),
                  logger.error,
                );
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

  private sendClip = async (req: Request, res: Response): Promise<void> => {
    // TODO: Properly distinguish between user and server errors
    return validateSendRequest(req.fields as SendRequest)
      .andThen<{ clipView: ClipView, sourceName: string }>(
      ({ id, sourceName }) => {
        const clipView = this.getVideoClipById(id).clipView;
        return clipView
          ? ok({ clipView, sourceName })
          : err(new Error(`No video clip with ID ${id} found`));
      })
      .asyncAndThen(({ clipView, sourceName }) =>
        this.visionMixer.setVideoInputFile(
          sourceName,
          this.media.getFullPath(clipView.clip.media),
        )
      )
      .match(
        () => {
          res.sendStatus(200);
        },
        err => sendUserError(res, err),
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
        return err(new Error(`No clip matches ID ${id}`));
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
        this.state as AssumeClipType<VideoClip>,
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

  private deleteMediaClip(
    data: DeleteRequest,
  ): Result<ClipView, Error> {
    return validateDeleteRequest(data).andThen(id => {
      const { index, clipView } = this.getClipById(id);
      if (clipView == null) {
        return err(new Error(`No clip matches ID ${id}`));
      }
      this.state = updateImmutable(
        this.state,
        { clips: { $splice: [[index, 1]] }},
      );
      this.broadcastState();
      return ok(clipView);
    });
  }

  private setClipAsRendered(id: string, video: VideoFile): Error | void {
    const { index, clipView: cv } = this.getVideoClipById(id);
    if (cv == null) {
      return new Error(`Clip ${id} deleted while cutting`);
    }
    this.state = updateImmutable(
      this.state as AssumeClipType<VideoClip>,
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
      this.state as AssumeClipType<VideoClip>,
      { clips: { [index]: { clip: { $merge: {
        waveform
      }}}}});
    this.broadcastState();
  }

  private setClipThumbnail(id: string, thumbnail: ImageFile): Error | void {
    const { index, clipView: cv } = this.getVideoClipById(id);
    if (cv == null) {
      return new Error(`Clip ${id} deleted while generating thumbnail`);
    }
    this.state = updateImmutable(
      this.state as AssumeClipType<VideoClip>,
      { clips: { [index]: { clip: { $merge: {
        thumbnail
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
  const id = clip.id;
  const desc = clip.description ? '_' + filenamify(clip.description).replace(/ /g, '-') : '';
  const ext = path.extname(clip.media.filename);
  return `${id}${desc}${ext}`;
}

function validateUpdateRequest(req: UpdateRequest): Result<ClipUpdate, Error> {
  const { id, startMs: startStr, endMs: endStr, description } = req;
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

function validateDeleteRequest(req: DeleteRequest): Result<string, Error> {
  const { id } = req;
  if (!id) {
    return err(new Error('id is required'));
  }
  return ok(id);
}

function validateSendRequest(req: SendRequest): Result<SendParams, Error> {
  const { id, sourceName } = req;
  if (!id) {
    return err(new Error('id is required'));
  }
  if (!sourceName) {
    return err(new Error('sourceName is required'));
  }
  return ok({ id, sourceName });
}
