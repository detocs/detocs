import { Error as ChainableError } from 'chainable-error';
import find from 'find-process';
import { promises as fs, statSync } from 'fs';
import { ResultAsync, okAsync } from 'neverthrow';
import { dirname, extname, isAbsolute, join, basename } from 'path';

import { Timestamp } from '@models/timestamp';
import { getConfig } from '@util/configuration/config';
import { Watcher, waitForFile } from '@util/fs';
import { getLogger } from '@util/logger';

import { ObsConnection } from './connection';
import pLimit from 'p-limit';

interface ProcessInfo {
  pid: number;
  ppid?: number;
  uid?: number;
  gid?: number;
  name: string;
  cmd: string;
  bin: string;
}

const logger = getLogger('services/obs');
// TODO: Get actual replay prefix from OBS
export const OBS_REPLAY_PREFIX = 'Replay';
const VIDEO_FILE_EXTENSIONS = ['.flv', '.mp4', '.mov', '.mkv', '.ts', '.m3u8'];

export default class ObsClient {
  private readonly obs: ObsConnection;
  private readonly recordingFolderQueue = pLimit(1);
  private currentRecordingFolder?: string = undefined;
  private currentRecordingFile?: string | null = undefined;
  public readonly on: ObsConnection['on'];
  public readonly off: ObsConnection['off'];
  public readonly once: ObsConnection['once'];

  public constructor(obs: ObsConnection) {
    this.obs = obs;
    this.on = obs.on.bind(obs);
    this.off = obs.off.bind(obs);
    this.once = obs.once.bind(obs);

    const updateRecordingFolder = (): ResultAsync<string, void> => {
      this.currentRecordingFolder = undefined;
      return this.getRecordingFolder().mapErr(logger.error);
    };
    const updateRecordingFile = (): ResultAsync<string | null, void> => {
      this.currentRecordingFile = undefined;
      return this.getRecordingFile().mapErr(logger.error);
    };
    this.on('ConnectionOpened', () => {
      updateRecordingFolder().andThen(updateRecordingFile);
    });
    // The recording file doesn't appear immediately
    this.on('RecordingStarted', () => setTimeout(updateRecordingFile, 2000));
    this.on('RecordingStopped', updateRecordingFile);
  }

  public isConnected(): boolean {
    return this.obs.isConnected();
  }

  public isRecording(): ResultAsync<boolean, Error> {
    return this.obs.send('GetStreamingStatus')
      .map(resp => resp['recording']);
  }

  public getTimestamps(): ResultAsync<{
    recordingTimestamp: Timestamp | null;
    streamTimestamp: Timestamp | null;
  }, Error> {
    return this.obs.send('GetStreamingStatus')
      .map(resp => ({
        streamTimestamp: resp['stream-timecode'] || null,
        recordingTimestamp: resp['rec-timecode'] || null,
      }));
  }

  public getRecordingFolder(): ResultAsync<string, Error> {
    return ResultAsync.fromPromise(
      this.recordingFolderQueue(async () => {
        if (this.currentRecordingFolder) {
          return this.currentRecordingFolder;
        }
        return this.obs.send('GetRecordingFolder')
          .map(async resp => {
            let folder = resp['rec-folder'];
            if (!isAbsolute(folder)) {
              const obsAddress = getConfig().obs.address;
              // Some super cool guy is using relative paths with OBS
              const obsPort = new URL(obsAddress.startsWith('http') ?
                obsAddress :
                'https://' + obsAddress
              ).port;
              const listeners = await find('port', obsPort);
              if (listeners.length) {
                folder = join(dirname((listeners[0] as ProcessInfo).bin), folder);
              }
            }
            this.currentRecordingFolder = folder;
            logger.info(`Recording folder: ${this.currentRecordingFolder}`);
            return folder;
          })
          .match(
            t => t,
            e => { throw e; },
          );
      }),
      e => e as Error,
    );
  }

  public getCurrentThumbnail(
    dimensions: { height?: number; width?: number },
  ): ResultAsync<string, Error> {
    return this.obs.send('GetCurrentScene')
      .andThen(resp => this.getSourceThumbnail(resp.name, dimensions));
  }

  public getSourceThumbnail(
    sourceName: string,
    dimensions: { height?: number; width?: number },
  ): ResultAsync<string, Error> {
    return this.obs.send('TakeSourceScreenshot', {
      sourceName,
      embedPictureFormat: 'png',
      ...dimensions,
    }).map(resp => resp.img);
  }

  public getOutputDimensions(): ResultAsync<{ width: number; height: number }, Error> {
    return this.obs.send('GetVideoInfo')
      .map(resp => ({ width: resp.outputWidth, height: resp.outputHeight }));
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
    return this.getRecordingFolder()
      .andThen(folder =>
        this.obs.send('SaveReplayBuffer')
          .andThen(() => ResultAsync.fromPromise(
            this.waitForReplayFile(folder),
            e => new ChainableError('Unable to save replay', e as Error),
          ))
      );
  }

  // 'SaveReplayBuffer' doesn't wait until the file written to resolve, so we
  // need to listen for file creation
  private waitForReplayFile = async (folder: string): Promise<string> => {
    const glob = join(folder, OBS_REPLAY_PREFIX) + '*';
    let watcher: Watcher | undefined;
    return new Promise<string>((resolve, reject) => {
      watcher = waitForFile(glob, resolve, reject);
      setTimeout(() => reject(new Error('Timed out while waiting for replay file')), 10 * 1000);
    })
      .finally(() => watcher && watcher.close());
  };
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
