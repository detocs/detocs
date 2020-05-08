import { getLogger } from 'log4js';
const logger = getLogger('server/media');
logger.error = logger.error.bind(logger);

import { promises as fs } from 'fs';
import ObsWebSocket, { ObsError } from 'obs-websocket-js';
import path from 'path';

import { Screenshot, Replay, MediaFile, VideoFile, ImageFile } from '../../models/media';
import { Timestamp } from '../../models/timestamp';
import { sleep } from '../../util/async';
import * as ffmpeg from '../../util/ffmpeg';
import { tmpDir, waitForFile, Watcher } from '../../util/fs';
import * as obs from '../../util/obs';
import * as pathUtil from '../../util/path';
import { sanitizeTimestamp, toMillis, fromMillis } from '../../util/timestamp';

import { ReplayCache } from './replayCache';
import { ScreenshotCache } from './screenshot-cache';

const THUMBNAIL_SIZE = 135;
const SCREENSHOT_CACHE_LENIENCY_MS = 1000;
const REPLAY_CACHE_LENIENCY_MS = 500;
const REPLAY_COMPLETION_POLL_ATTEMPTS = 10;
const REPLAY_COMPLETION_POLL_INTERVAL_MS = 250;

export class MediaServer {
  private readonly obsWs = new ObsWebSocket();
  private readonly dirName: string;
  private dir: string | undefined;
  private isConnected = false;
  private streamWidth = 0;
  private streamHeight = 0;
  private recordingFile?: string;
  private recordingFolder?: string;
  // TODO: Cache per recording file
  private fullScreenshotCache = new ScreenshotCache(SCREENSHOT_CACHE_LENIENCY_MS);
  private thumbnailCache = new ScreenshotCache(SCREENSHOT_CACHE_LENIENCY_MS);
  private replayCache = new ReplayCache(REPLAY_CACHE_LENIENCY_MS);

  public constructor(dirName = 'media') {
    this.dirName = dirName;
  }

  public start(): void {
    this.dir = tmpDir(this.dirName);
    fs.mkdir(this.dir, { recursive: true });
    this.initObs();
  }

  private initObs(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.obsWs.on('error' as any, logger.error);
    this.obsWs.on('ConnectionClosed', () => {
      this.isConnected = false;
    });
    // The recording file doesn't appear immediately
    this.obsWs.on('RecordingStarted', () => setTimeout(this.getRecordingFile.bind(this), 2000));
    obs.connect(this.obsWs, async () => {
      this.isConnected = true;
      logger.info('Connected to OBS');
      obs.isRecording(this.obsWs)
        .then(isRecording => {
          if (isRecording) {
            this.getRecordingFile();
          } else {
            this.getRecordingFolder();
          }
        });
      obs.getOutputDimensions(this.obsWs)
        .then(dims => {
          this.streamWidth = dims.width;
          this.streamHeight = dims.height;
        });
    });
  }

  public connected(): boolean {
    return this.isConnected;
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

  private async getRecordingFile(): Promise<void> {
    const { file, folder } = await obs.getRecordingFile(this.obsWs);
    // TODO: FFmpeg cannot operate on certain file types while they're still being written (e.g.
    // mp4). We should handle this somehow.
    this.recordingFile = file;
    this.recordingFolder = folder;
    logger.info(`Recording file: ${this.recordingFile}`);
    logger.info(`Recording folder: ${this.recordingFolder}`);
    this.fullScreenshotCache = new ScreenshotCache(SCREENSHOT_CACHE_LENIENCY_MS);
    this.thumbnailCache = new ScreenshotCache(SCREENSHOT_CACHE_LENIENCY_MS);
    this.replayCache = new ReplayCache(REPLAY_CACHE_LENIENCY_MS);
  }

  private async getRecordingFolder(): Promise<void> {
    const folder = await obs.getRecordingFolder(this.obsWs);
    this.recordingFolder = folder;
    logger.info(`Recording folder: ${this.recordingFolder}`);
  }

  private async getCurrentScreenshot(height: number): Promise<Screenshot> {
    const timestampPromise = obs.getRecordingTimestamp(this.obsWs);
    const imgPromise = obs.getCurrentThumbnail(this.obsWs, { height });
    const [ timestamp, base64Img ] = await Promise.all([timestampPromise, imgPromise]);
    if (!base64Img) {
      throw new Error('Couldn\'t get screenshot');
    }

    const filename = await this.saveImageFile(
      timestamp,
      height,
      Buffer.from(base64Img.substring(22), 'base64'),
    );
    return {
      image: { filename, url: this.getUrl(filename), type: 'image', height },
      timestampMs: timestamp ? toMillis(timestamp) : undefined,
    };
  }

  private async getVideoFrameFromMainRecording(
    timestamp: Timestamp,
    height: number,
  ): Promise<Buffer> {
    if (!this.recordingFile) {
      throw new Error('Recording not started');
    }
    return this.getVideoFrame(this.recordingFile, timestamp, height);
  }

  private async getVideoFrameFromReplay(
    replay: Required<Replay>,
    millis: number,
    height: number,
  ): Promise<Buffer> {
    return this.getVideoFrame(
      this.getFullPath(replay.video),
      fromMillis(millis - replay.startMs),
      height,
    );
  }

  private async getVideoFrame(
    videoFile: string,
    timestamp: Timestamp,
    height: number,
  ): Promise<Buffer> {
    const img = await ffmpeg.getVideoFrame(videoFile, timestamp, { height })
      .catch(logger.error);
    if (!img) {
      throw new Error('Unable to get video thumbnail');
    }
    return img;
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
    this.getReplay();
    return this.getCurrentScreenshot(THUMBNAIL_SIZE)
      .then(s => {
        this.thumbnailCache.add(s);
        return s;
      });
  }

  public async getFullScreenshot(timestamp: Timestamp): Promise<Screenshot> {
    return this.getScreenshot(
      timestamp,
      [ this.fullScreenshotCache ],
      [ this.fullScreenshotCache, this.thumbnailCache ],
      this.streamHeight,
    );
  }

  public async getThumbnail(timestamp: Timestamp): Promise<Screenshot> {
    return this.getScreenshot(
      timestamp,
      [ this.thumbnailCache, this.fullScreenshotCache ],
      [ this.thumbnailCache ],
      THUMBNAIL_SIZE,
    );
  }

  private async getScreenshot(
    timestamp: Timestamp,
    readCaches: ScreenshotCache[],
    writeCaches: ScreenshotCache[],
    height: number,
  ): Promise<Screenshot> {
    const millis = toMillis(timestamp);
    for (const cache of readCaches) {
      const cachedScreenshot = cache.get(millis);
      if (cachedScreenshot) {
        return cachedScreenshot;
      }
    }
    let asyncImage: Promise<Buffer> | undefined;
    const cachedReplay = this.replayCache.get(millis);
    if (cachedReplay) {
      asyncImage = this.getVideoFrameFromReplay(cachedReplay, millis, height);
    } else {
      asyncImage = this.getVideoFrameFromMainRecording(timestamp, height);
    }
    const img = await asyncImage;
    const filename = await this.saveImageFile(timestamp, height, img);
    const screenshot: Screenshot = {
      image: { filename, url: this.getUrl(filename), type: 'image', height },
      timestampMs: millis,
    };
    writeCaches.forEach(cache => cache.add(screenshot));
    return screenshot;
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

  public async getReplay(): Promise<Replay | null> {
    // TODO: 'SaveReplayBuffer' doesn't wait until the file written to resolve, so we'll need to
    // figure out something else here.
    return this.obsWs.send('SaveReplayBuffer')
      .catch((err: ObsError) => { throw new Error(err.error); })
      .then(this.waitForReplayFile)
      .then(r => r ? this.fetchReplayFile(r) : null);
  }

  private waitForReplayFile = async (): Promise<string | null> => {
    if (!this.recordingFolder) {
      throw new Error('Missing recording folder path');
    }
    const glob = path.join(this.recordingFolder, obs.OBS_REPLAY_PREFIX) + '*';
    let watcher: Watcher | undefined;
    return new Promise<string | null>((resolve) => {
      watcher = waitForFile(glob, resolve);
      setTimeout(() => resolve(null), 3000);
    })
      .finally(() => watcher && watcher.close());
  };

  private async fetchReplayFile(filePath: string): Promise<Replay> {
    logger.info('Fetching replay file:', filePath);
    const videoStats = await this.waitForVideoFileCompletion(filePath);
    if (!videoStats) {
      throw new Error(`File ${filePath} never completed`);
    }

    const dir = this.getDir();
    const nowMs = Date.now();
    const [ timestamp, fileStats, copiedFilePath ] = await Promise.all([
      obs.getRecordingTimestamp(this.obsWs),
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

    const waveform = await this.getVideoWaveform(video);

    const replay: Replay = { video, waveform };
    if (timestamp && fileStats) {
      const endMillis = toMillis(timestamp) - (nowMs - Math.trunc(fileStats.birthtimeMs));
      const startMillis = endMillis - videoStats.durationMs;
      replay.endMs = endMillis;
      replay.startMs = startMillis;
      this.replayCache.add(replay);
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
