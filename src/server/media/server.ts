import { Error as ChainableError } from 'chainable-error';
import { promises as fs } from 'fs';
import path from 'path';

import { Screenshot, Replay, MediaFile, VideoFile, ImageFile } from '@models/media';
import { Timestamp } from '@models/timestamp';
import ObsClient from '@services/obs/obs';
import { sleep } from '@util/async';
import { getConfig } from '@util/configuration/config';
import * as ffmpeg from '@util/ffmpeg';
import { tmpDir } from '@util/fs';
import { getLogger } from '@util/logger';
import * as pathUtil from '@util/path';
import { sanitizeTimestamp, toMillis, fromMillis } from '@util/timestamp';

import { ReplayCache } from './replayCache';
import { ScreenshotCache } from './screenshot-cache';
import { err, ResultAsync, ok, okAsync } from 'neverthrow';

const logger = getLogger('server/media');
const THUMBNAIL_SIZE = 135;
const SCREENSHOT_CACHE_LENIENCY_MS = 1000;
const REPLAY_CACHE_LENIENCY_MS = 500;
const REPLAY_COMPLETION_POLL_ATTEMPTS = 10;
const REPLAY_COMPLETION_POLL_INTERVAL_MS = 250;

export class MediaServer {
  private readonly obs: ObsClient;
  private readonly dirName: string;
  private dir: string | undefined;
  private streamWidth = 0;
  private streamHeight = 0;
  // TODO: Cache per recording file
  private fullScreenshotCache = new ScreenshotCache(SCREENSHOT_CACHE_LENIENCY_MS);
  private thumbnailCache = new ScreenshotCache(SCREENSHOT_CACHE_LENIENCY_MS);
  private replayCache = new ReplayCache(REPLAY_CACHE_LENIENCY_MS);

  public constructor({ obsClient, dirName }: { obsClient: ObsClient; dirName: string }) {
    this.obs = obsClient;
    this.dirName = dirName;
  }

  public start(): void {
    this.dir = tmpDir(this.dirName);
    fs.mkdir(this.dir, { recursive: true });
    this.deleteOldTempFiles(this.dir);
    this.initObs();
  }

  private async deleteOldTempFiles(dir: string): Promise<void[]> {
    const cutoff = Date.now() - getConfig().tempFileExpirationDays * 24 * 60 * 60 * 1000;
    const files = await fs.readdir(dir);
    return Promise.all(files.map(file => {
      const filePath = path.join(dir, file);
      return fs.stat(filePath).then(async stats => {
        if (stats.birthtimeMs < cutoff) {
          logger.debug(`Deleting expired temp file ${filePath}`);
          return fs.unlink(filePath);
        }
      });
    }));
  }

  private initObs(): void {
    this.obs.on('RecordingStarted', () => this.resetCaches());
    this.obs.on('ConnectionOpened', async () => {
      this.obs.getOutputDimensions()
        .map(dims => {
          this.streamWidth = dims.width;
          this.streamHeight = dims.height;
        });
    });
  }

  public connected(): boolean {
    return this.obs.isConnected();
  }

  public getDir(): string {
    if (!this.dir) {
      throw new Error('Server used before starting');
    }
    return this.dir;
  }

  public getDirName(): string {
    return this.dirName;
  }

  private async resetCaches(): Promise<void> {
    this.fullScreenshotCache = new ScreenshotCache(SCREENSHOT_CACHE_LENIENCY_MS);
    this.thumbnailCache = new ScreenshotCache(SCREENSHOT_CACHE_LENIENCY_MS);
    this.replayCache = new ReplayCache(REPLAY_CACHE_LENIENCY_MS);
  }

  private async getCurrentScreenshot(height: number): Promise<Screenshot> {
    const timestampPromise = this.obs.getTimestamps()
      .match(
        t => t,
        e => { throw e; },
      );
    const imgPromise = this.obs.getCurrentThumbnail({ height })
      .match(
        t => t,
        e => { throw e; },
      );
    const [ timestamps, base64Img ] = await Promise.all([timestampPromise, imgPromise]);
    if (!base64Img) {
      throw new Error('Couldn\'t get screenshot');
    }

    const filename = await this.saveImageFile(
      timestamps.recordingTimestamp,
      height,
      Buffer.from(base64Img.substring(22), 'base64'),
    );
    return {
      image: { filename, url: this.getUrl(filename), type: 'image', height },
      recordingTimestampMs: timestamps.recordingTimestamp ?
        toMillis(timestamps.recordingTimestamp) :
        undefined,
      streamTimestampMs: timestamps.streamTimestamp ?
        toMillis(timestamps.streamTimestamp) :
        undefined,
    };
  }

  private getVideoFrameFromMainRecording(
    timestamp: Timestamp,
    height: number,
  ): ResultAsync<Buffer, Error> {
    // TODO: FFmpeg cannot operate on certain file types while they're still being written (e.g.
    // mp4). We should handle this somehow.
    return this.obs.getRecordingFile()
      .andThen<string>(file =>
      file
        ? ok(file)
        : err(new Error('Recording not started')))
      .andThen(file =>
        this.getVideoFrame(file, timestamp, height));
  }

  private getVideoFrameFromReplay(
    replay: Replay & { recordingTimestampMs: number },
    millis: number,
    height: number,
  ): ResultAsync<Buffer, Error> {
    return this.getVideoFrame(
      this.getFullPath(replay.video),
      fromMillis(millis - replay.recordingTimestampMs),
      height,
    );
  }

  private getVideoFrame(
    videoFile: string,
    timestamp: Timestamp,
    height: number,
  ): ResultAsync<Buffer, Error> {
    return ResultAsync.fromPromise(
      ffmpeg.getVideoFrame(videoFile, timestamp, { height }),
      e => new ChainableError('Unable to get video thumbnail', e as Error)
    );
  }

  public async getCurrentFullScreenshot(): Promise<Screenshot> {
    return this.getCurrentScreenshot(this.streamHeight)
      .then(s => {
        this.fullScreenshotCache.add(s);
        this.thumbnailCache.add(s);
        return s;
      });
  }

  public async getCurrentThumbnail(): Promise<Screenshot> {
    this.getReplay().mapErr(logger.warn);
    return this.getCurrentScreenshot(THUMBNAIL_SIZE)
      .then(s => {
        this.thumbnailCache.add(s);
        return s;
      });
  }

  public getFullScreenshot(timestamp: Timestamp): ResultAsync<Screenshot, Error> {
    return this.getScreenshot(
      timestamp,
      [ this.fullScreenshotCache ],
      [ this.fullScreenshotCache, this.thumbnailCache ],
      this.streamHeight,
    );
  }

  public getThumbnail(timestamp: Timestamp): ResultAsync<Screenshot, Error> {
    return this.getScreenshot(
      timestamp,
      [ this.thumbnailCache, this.fullScreenshotCache ],
      [ this.thumbnailCache ],
      THUMBNAIL_SIZE,
    );
  }

  private getScreenshot(
    timestamp: Timestamp,
    readCaches: ScreenshotCache[],
    writeCaches: ScreenshotCache[],
    height: number,
  ): ResultAsync<Screenshot, Error> {
    const millis = toMillis(timestamp);
    for (const cache of readCaches) {
      const cachedScreenshot = cache.get(millis);
      if (cachedScreenshot) {
        return okAsync(cachedScreenshot);
      }
    }
    let asyncImage: ResultAsync<Buffer, Error> | undefined;
    const cachedReplay = this.replayCache.get(millis);
    if (cachedReplay) {
      asyncImage = this.getVideoFrameFromReplay(cachedReplay, millis, height);
    } else {
      asyncImage = this.getVideoFrameFromMainRecording(timestamp, height);
    }
    return asyncImage.map(async img => {
      const filename = await this.saveImageFile(timestamp, height, img);
      const screenshot: Screenshot = {
        image: { filename, url: this.getUrl(filename), type: 'image', height },
        recordingTimestampMs: millis,
        // TODO: streamTimestampMs?
      };
      writeCaches.forEach(cache => cache.add(screenshot));
      return screenshot;
    });
  }

  private async saveImageFile(
    timestamp: string | null,
    size: number,
    img: Buffer,
  ): Promise<string> {
    const timestampStr = timestamp ? sanitizeTimestamp(timestamp) : Date.now();
    const filename = `${timestampStr}_${size}.png`;
    await this.saveFile(filename, img);
    return filename;
  }

  private async saveFile(filename: string, data: unknown): Promise<void> {
    return await fs.writeFile(this.getFullPath(filename), data, { encoding: 'hex' });
  }

  private getUrl(filename: string): string {
    return `/${this.dirName}/${filename}`;
  }

  public getFullPath(fileOrName: MediaFile | string): string {
    const filename = typeof fileOrName === 'string' ?
      fileOrName :
      fileOrName.filename;
    return path.normalize(path.join(this.getDir(), filename));
  }

  // TODO: Get rid of this
  public getPathFromUrl(url: string): string {
    return url.replace(`/${this.dirName}`, this.getDir());
  }

  public getReplay(): ResultAsync<Replay, Error> {
    return this.obs.saveReplayBuffer()
      .andThen(file => ResultAsync.fromPromise(
        this.fetchReplayFile(file),
        e => e as Error));
  }

  private async fetchReplayFile(filePath: string): Promise<Replay> {
    logger.info('Fetching replay file:', filePath);
    const videoStats = await this.waitForVideoFileCompletion(filePath);
    if (!videoStats) {
      throw new Error(`File ${filePath} never completed`);
    }

    const dir = this.getDir();
    const nowMs = Date.now();
    const [ timestamps, fileStats, copiedFilePath ] = await Promise.all([
      this.obs.getTimestamps()
        .match(
          t => t,
          e => { throw e; },
        ),
      fs.stat(filePath),
      ffmpeg.copyToWebCompatibleFormat(filePath, dir),
    ]);
    if (!copiedFilePath) {
      throw new Error(`Unable to copy replay file to ${dir}`);
    }

    fs.unlink(filePath);
    const filename = path.basename(copiedFilePath);
    const video: VideoFile = {
      type: 'video',
      filename,
      url: this.getUrl(filename),
      durationMs: videoStats.durationMs,
    };

    const [ waveform, thumbnail ] = await Promise.all([
      this.getVideoWaveform(video),
      this.getVideoThumbnail(video)
        .match(
          t => t,
          e => { throw e; },
        ),
    ]);

    const replay: Replay = { video, waveform, thumbnail };
    if (timestamps && fileStats) {
      const msSinceFileCreation = nowMs - Math.trunc(fileStats.birthtimeMs);
      if (timestamps.streamTimestamp) {
        const endMillis = toMillis(timestamps.streamTimestamp) - msSinceFileCreation;
        replay.streamTimestampMs = endMillis - videoStats.durationMs;
      }
      if (timestamps.recordingTimestamp) {
        const endMillis = toMillis(timestamps.recordingTimestamp) - msSinceFileCreation;
        replay.recordingTimestampMs = endMillis - videoStats.durationMs;
        this.replayCache.add(replay);
      }
    }
    return replay;
  }

  private async waitForVideoFileCompletion(
    filePath: string,
  ): Promise<Required<ffmpeg.VideoStats> | null> {
    for (let i = 0; i < REPLAY_COMPLETION_POLL_ATTEMPTS; i++) {
      const stats = await ffmpeg.getVideoStats(filePath);
      if (stats.durationMs == null) {
        logger.debug('Video file not finished writing:', filePath);
        await sleep(REPLAY_COMPLETION_POLL_INTERVAL_MS);
        continue;
      }
      return stats as Required<ffmpeg.VideoStats>;
    }
    return null;
  }

  public async getVideoWaveform(video: VideoFile): Promise<ImageFile> {
    const filePath = this.getFullPath(video);
    const waveformFilename = `${pathUtil.withoutExtension(video.filename)}_waveform.png`;
    const waveformPath = this.getFullPath(waveformFilename);
    await ffmpeg.getWaveform(filePath, waveformPath, video.durationMs);
    return {
      type: 'image',
      filename: waveformFilename,
      url: this.getUrl(waveformFilename),
      height: ffmpeg.WAVEFORM_HEIGHT,
    };
  }

  public getVideoThumbnail(video: VideoFile): ResultAsync<ImageFile, Error> {
    const size = THUMBNAIL_SIZE;
    return this.getVideoFrame(
      this.getFullPath(video),
      '0:00:00',
      size,
    ).andThen(img => {
      const thumbnailFilename =
        `${pathUtil.withoutExtension(video.filename)}_thumbnail_${size}.png`;
      return ResultAsync.fromPromise(
        this.saveFile(thumbnailFilename, img),
        e => new ChainableError('Unable to save thumbnail', e as Error),
      ).map(() => ({
        type: 'image',
        filename: thumbnailFilename,
        url: this.getUrl(thumbnailFilename),
        height: size,
      }));
    });
  }

  public async cutVideo(
    video: VideoFile,
    startMs: number,
    endMs: number,
    filename: string,
  ): Promise<VideoFile> {
    await ffmpeg.lossyCut(
      this.getFullPath(video),
      fromMillis(startMs),
      fromMillis(endMs),
      this.getFullPath(filename),
    );
    // TODO: We might need to actually read the file metadata and get the real
    // duration
    return {
      type: 'video',
      filename,
      url: this.getUrl(filename),
      durationMs: endMs - startMs,
    };
  }
}
