import { Error as ChainableError } from 'chainable-error';
import findProcess from 'find-process';
import { promises as fs, statSync } from 'fs';
import { ResultAsync, okAsync, ok, err } from 'neverthrow';
import ObsWebSocket, { OBSEventTypes, OBSResponseTypes, RequestBatchExecutionType, ResponseMessage } from 'obs-websocket-js';
import pLimit from 'p-limit';
import { dirname, extname, isAbsolute, join, basename } from 'path';

import { Timestamp } from '@models/timestamp';
import VisionMixer, { ImageData, Scene, VideoInput } from '@services/vision-mixer-service';
import { Config, getConfig } from '@util/configuration/config';
import { getLogger } from '@util/logger';
import * as png from '@util/png';

import { ObsConnection, ObsConnectionImpl } from './connection';

interface ProcessInfo {
  pid: number;
  ppid?: number;
  uid?: number;
  gid?: number;
  name: string;
  cmd: string;
  bin: string;
}
type VideoSettings = OBSResponseTypes['GetVideoSettings'];

const logger = getLogger('services/obs');
// TODO: Get actual replay prefix from OBS
export const OBS_REPLAY_PREFIX = 'Replay';
const VIDEO_FILE_EXTENSIONS = ['.flv', '.mp4', '.mov', '.mkv', '.ts', '.m3u8'];
const VIDEO_INPUT_KINDS = ['ffmpeg_source', 'vlc_source'];

export default class ObsClient implements VisionMixer {
  private readonly obs: ObsConnection;
  private readonly config: Config['obs'];
  private readonly recordingFolderQueue = pLimit(1);
  private currentRecordingFolder?: string = undefined;
  private currentRecordingFile?: string | null = undefined;
  private videoSettings?: VideoSettings = undefined;
  private previousRecordingState?: OBSEventTypes['RecordStateChanged']['outputState'] = undefined;
  public readonly on: ObsConnection['on'];
  public readonly off: ObsConnection['off'];
  public readonly once: ObsConnection['once'];

  static getClient(): ObsClient {
    const config = getConfig().obs;
    const obsConn = new ObsConnectionImpl(new ObsWebSocket(), config);
    const obsClient = new ObsClient(obsConn, config);
    return obsClient;
  }

  public constructor(obs: ObsConnection, config: Config['obs']) {
    this.obs = obs;
    this.config = config;
    this.on = obs.on.bind(obs);
    this.off = obs.off.bind(obs);
    this.once = obs.once.bind(obs);

    this.on('Identified', () => {
      this.clearCache();
      this.getVideoDimensions()
        .andThen(this.isRecording.bind(this))
        .andThen(this.getRecordingFolder.bind(this))
        .andThen(this.getRecordingFile.bind(this))
        .mapErr(logger.error);
    });
    this.on('ConnectionClosed', () => this.clearCache());
    this.onRecordingStart(() => {
      // The recording file doesn't appear immediately
      setTimeout(() => this.getRecordingFile().mapErr(logger.error), 2000);
    });
    this.onRecordingStart(() => {
      this.currentRecordingFile = undefined;
    });
  }

  public connect(): ResultAsync<void, Error> {
    return ResultAsync.fromPromise(this.obs.connect(), e => e as Error);
  }

  public disconnect(): ResultAsync<void, Error> {
    return ResultAsync.fromPromise(
      this.obs.disconnect(),
      e => e as Error,
    );
  }

  public isConnected(): boolean {
    return this.obs.isConnected();
  }

  public onConnect(cb: () => void): void {
    this.on('Identified', cb);
  }

  public getOutputDimensions(): ResultAsync<{ width: number; height: number }, Error> {
    return this.getVideoDimensions()
      .map(resp => ({ width: resp.outputWidth, height: resp.outputHeight }));
  }

  public getSceneList(): ResultAsync<Scene[], Error> {
    return this.obs.call('GetSceneList')
      .map(({ scenes }) => {
        // OBS Studio returns scenes in reverse order for some reason
        return scenes.reverse().map(s => ({
          name: s['sceneName'] as string,
        }));
      });
  }

  public onSceneListUpdate(cb: (scenes: Scene[]) => void): void {
    const sendUpdate = (): void => {
      this.getSceneList().match(
        cb,
        logger.error,
      );
    };
    this.obs.on('SceneCreated', sendUpdate);
    this.obs.on('SceneRemoved', sendUpdate);
    this.obs.on('SceneNameChanged', sendUpdate);
    this.obs.on('Identified', sendUpdate);
    this.obs.on('ConnectionClosed', () => cb([]));
  }

  public getVideoInputList(): ResultAsync<VideoInput[], Error> {
    return this.obs.callBatch(VIDEO_INPUT_KINDS.map(kind => ({
      requestType: 'GetInputList',
      requestData: { inputKind: kind }
    })), { executionType: RequestBatchExecutionType.Parallel })
      .map(responses => (responses as ResponseMessage<'GetInputList'>[])
        .flatMap(r => r.responseData.inputs)
      )
      .map(inputs => inputs.map(i => ({
        name: i['inputName'] as string,
      })));
  }

  public onVideoInputListUpdate(cb: (inputs: VideoInput[]) => void): void {
    const sendUpdate = (): void => {
      this.getVideoInputList().match(
        cb,
        logger.error,
      );
    };
    this.obs.on('InputCreated', i => {
      if (VIDEO_INPUT_KINDS.includes(i.inputKind)) {
        sendUpdate();
      }
    });
    this.obs.on('InputRemoved', sendUpdate);
    this.obs.on('InputNameChanged', sendUpdate);
    this.obs.on('Identified', sendUpdate);
    this.obs.on('ConnectionClosed', () => cb([]));
  }

  public setVideoInputFile(
    name: string,
    path: string,
  ): ResultAsync<void, Error> {
    return this.obs.call('GetInputSettings', { inputName: name })
      .map(({inputKind}) => {
        switch (inputKind) {
          case 'ffmpeg_source':
            return ({
              'is_local_file': true,
              'local_file': path,
            });
          case 'vlc_source':
            return ({
              'playlist': [
                {
                  'hidden': false,
                  'selected': false,
                  'value': path,
                },
              ],
            });
          default:
            return {};
        }
      })
      .andThen(settings =>
        this.obs.call('SetInputSettings', {
          inputName: name,
          inputSettings: settings,
        })
      );
  }

  public startRecording(): ResultAsync<void, Error> {
    return this.obs.call('StartRecord');
  }

  public stopRecording(): ResultAsync<void, Error> {
    return this.obs.call('StopRecord');
  }

  public onRecordingStart(cb: () => void): void {
    this.on('RecordStateChanged', evt => {
      if (evt.outputState === 'OBS_WEBSOCKET_OUTPUT_STARTED' &&
        evt.outputState !== this.previousRecordingState
      ) {
        cb();
      }
      this.obs.call('GetRecordStatus').map(s => logger.debug('status after event', s));
      // Ensure that all event handlers called within this tick are treated the same
      setTimeout(() => this.previousRecordingState = evt.outputState);
    });
  }

  public onRecordingStop(cb: () => void): void {
    this.on('RecordStateChanged', evt => {
      if (evt.outputState === 'OBS_WEBSOCKET_OUTPUT_STOPPING' &&
        evt.outputState !== this.previousRecordingState
      ) {
        cb();
      }
      // Ensure that all event handlers called within this tick are treated the same
      setTimeout(() => this.previousRecordingState = evt.outputState);
    });
  }

  public isRecording(): ResultAsync<boolean, Error> {
    return this.obs.call('GetRecordStatus')
      .map(resp => resp.outputActive);
  }

  public getTimestamps(): ResultAsync<{
    recordingTimestamp: Timestamp | null;
    streamTimestamp: Timestamp | null;
  }, Error> {
    return this.obs.callBatch(
      [
        { requestType: 'GetStreamStatus' },
        { requestType: 'GetRecordStatus' },
      ],
      { executionType: RequestBatchExecutionType.SerialRealtime },
    ).map(responses => {
      const [
        { responseData: streamResp },
        { responseData: recResp },
      ] = responses as [ResponseMessage<'GetStreamStatus'>, ResponseMessage<'GetRecordStatus'>];
      return ({
        streamTimestamp: streamResp.outputActive ? streamResp.outputTimecode : null,
        recordingTimestamp: recResp.outputActive ? recResp.outputTimecode : null,
      });
    });
  }

  private clearCache(): void {
    this.videoSettings = undefined;
    this.currentRecordingFolder = undefined;
    this.currentRecordingFile = undefined;
  }

  private getVideoDimensions(): ResultAsync<VideoSettings, Error> {
    if (this.videoSettings) {
      return okAsync(this.videoSettings);
    }
    return this.obs.call('GetVideoSettings')
      .map(resp => {
        this.videoSettings = resp;
        return resp;
      });
  }

  public getRecordingFolder(): ResultAsync<string, Error> {
    return ResultAsync.fromPromise(
      this.recordingFolderQueue(async () => {
        if (this.currentRecordingFolder) {
          return this.currentRecordingFolder;
        }
        return this.obs.call('GetRecordDirectory')
          .andThen(resp => {
            const folder = resp.recordDirectory;
            let asyncFolder = okAsync<string, Error>(folder);
            if (!isAbsolute(folder)) {
              // Some super cool guy is using relative paths with OBS
              logger.debug(`Non-absolute path found: ${folder}\n` +
                'Attempting to find OBS binary path.');
              asyncFolder = this.getBinPath()
                .map(obsBinPath => {
                  return join(obsBinPath, folder);
                });
            }
            return asyncFolder.map(folder => {
              this.currentRecordingFolder = folder;
              logger.info(`Recording folder: ${this.currentRecordingFolder}`);
              return folder;
            });
          })
          .match(
            t => t,
            e => { throw e; },
          );
      }),
      e => e as Error,
    );
  }

  private getBinPath(): ResultAsync<string, Error> {
    const configBinPath = this.config.binPath;
    if (configBinPath) {
      return okAsync(configBinPath);
    }
    const obsAddress = this.config.address;
    const obsPort = new URL(obsAddress.startsWith('http') ?
      obsAddress :
      'https://' + obsAddress
    ).port;
    return ResultAsync.fromPromise(
      findProcess('port', obsPort),
      e => e as Error,
    ).andThen(listeners => {
      if (!listeners.length) {
        return err(new Error(`No process found listening on port ${obsPort}`));
      }
      const listener = listeners[0] as ProcessInfo;
      if (!listener.bin) {
        return err(new Error(`Unable to read file path for ${listener.name}. ` +
          'Is the process running as a different user? ' +
          'Consider using the obs.binPath config setting.'));
      }
      return ok(dirname(listener.bin));
    });
  }

  public getCurrentThumbnail(
    dimensions?: { height?: number; width?: number },
  ): ResultAsync<ImageData, Error> {
    return this.obs.call('GetCurrentProgramScene')
      .andThen(resp => this.getSourceThumbnail(resp.currentProgramSceneName, dimensions));
  }

  public getSourceThumbnail(
    sourceName: string,
    dimensions?: { height?: number; width?: number },
  ): ResultAsync<ImageData, Error> {
    return this.obs.call('GetSourceScreenshot', {
      sourceName,
      imageFormat: 'png',
      imageWidth: dimensions?.width,
      imageHeight: dimensions?.height,
    }).map(resp => {
      const data = png.decodeBase64(resp.imageData);
      return ({
        width: png.parseWidth(data),
        height: png.parseHeight(data),
        data,
      });
    });
  }

  public getRecordingFile(): ResultAsync<string | null, Error> {
    if (this.currentRecordingFile !== undefined) {
      return okAsync(this.currentRecordingFile);
    }
    return this.isRecording()
      .andThen(isRecording =>
        isRecording
          ? this.getRecordingFolder().andThen(getLatestRecordingFileFromFolder)
          : okAsync(null)
      )
      .map(file => {
        this.currentRecordingFile = file;
        logger.info(`Recording file: ${this.currentRecordingFile}`);
        return file;
      });
  }

  public saveReplayBuffer(): ResultAsync<string, Error> {
    const promise = new Promise<string>((resolve, reject) => {
      setTimeout(() => reject(new Error('Timed out while waiting for replay file')), 30 * 1000);
      this.obs.once('ReplayBufferSaved', evt => resolve(evt.savedReplayPath));
      this.obs.call('SaveReplayBuffer');
    });
    return ResultAsync.fromPromise(
      promise,
      e => e as Error,
    );
  }
}

function getLatestRecordingFileFromFolder(folder: string): ResultAsync<string | null, Error> {
  return ResultAsync.fromPromise(
    fs.readdir(folder)
      .then(files => ({ folder, files })),
    e => new ChainableError(`Unable to read files from ${folder}`, e as Error))
    .map(async ({ folder, files }) => {
      files = files.filter(f => VIDEO_FILE_EXTENSIONS.includes(extname(f)))
        .filter(f => !basename(f).startsWith(OBS_REPLAY_PREFIX));
      const timestamps = files.reduce((map: Map<string, number>, file: string) => {
        const stat = statSync(join(folder, file));
        map.set(file, stat.birthtimeMs);
        return map;
      }, new Map());
      files.sort((a: string, b: string) => (timestamps.get(a) || 0) - (timestamps.get(b) || 0));
      const file = join(folder, files.pop() || '');

      return file;
    });
}
