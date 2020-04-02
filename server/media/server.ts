import { getLogger } from 'log4js';
const logger = getLogger('server/media');
logger.error = logger.error.bind(logger);

import { promises as fs } from 'fs';
import ObsWebSocket from 'obs-websocket-js';
import path from 'path';

import { Screenshot, ImageFile, Replay } from '../../models/media';
import { Timestamp } from '../../models/timestamp';
import { delay } from '../../util/async';
import * as ffmpeg from '../../util/ffmpeg';
import { tmpDir } from '../../util/fs';
import * as obs from '../../util/obs';
import { sanitizeTimestamp, toMillis } from '../../util/timestamp';

import { ScreenshotCache } from './screenshot-cache';
import { ReplayCache } from './replayCache';

const THUMBNAIL_SIZE = 135;
const SCREENSHOT_CACHE_LENIENCY_MS = 1000;
const REPLAY_CACHE_LENIENCY_MS = 500;

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
        .then(isRecording => { if (isRecording) { this.getRecordingFile(); } });
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

  private async getCurrentScreenshot(height: number): Promise<Screenshot> {
    const timestampPromise = obs.getRecordingTimestamp(this.obsWs);
    const imgPromise = obs.getCurrentThumbnail(this.obsWs, { height });
    const [ timestamp, base64Img ] = await Promise.all([timestampPromise, imgPromise]);
    if (!base64Img) {
      throw new Error('Couldn\'t get screenshot');
    }

    const fileName = await this.saveImageFile(
      timestamp,
      height,
      Buffer.from(base64Img.substring(22), 'base64'),
    );
    return {
      image: { url: this.getUrl(fileName), type: 'image', height },
      timestampMillis: timestamp ? toMillis(timestamp) : undefined,
    };
  }

  private async getScreenshot(timestamp: Timestamp, height: number): Promise<Screenshot> {
    if (!this.recordingFile) {
      throw new Error('Recording not started');
    }
    const img = await ffmpeg.getVideoFrame(this.recordingFile, timestamp, { height })
      .catch(logger.error);
    if (!img) {
      throw new Error('Unable to get video thumbnail');
    }
    const fileName = await this.saveImageFile(timestamp, height, img);
    return {
      image: { url: this.getUrl(fileName), type: 'image', height },
      timestampMillis: toMillis(timestamp),
    };
  }

  public async getCurrentFullScreenshot(): Promise<ImageFile> {
    return this.getCurrentScreenshot(this.streamHeight)
      .then(s => {
        this.fullScreenshotCache.add(s);
        this.thumbnailCache.add(s);
        return s.image;
      });
  }

  public async getCurrentThumbnail(): Promise<ImageFile> {
    this.cacheReplay();
    return this.getCurrentScreenshot(THUMBNAIL_SIZE)
      .then(s => {
        this.thumbnailCache.add(s);
        return s.image;
      });
  }

  public async getFullScreenshot(timestamp: Timestamp): Promise<ImageFile> {
    const millis = toMillis(timestamp);
    const cached = this.fullScreenshotCache.get(millis);
    if (cached) {
      return cached.image;
    }
    return this.getScreenshot(timestamp, this.streamHeight)
      .then(s => {
        this.fullScreenshotCache.add(s);
        this.thumbnailCache.add(s);
        return s.image;
      });
  }

  public async getThumbnail(timestamp: Timestamp): Promise<ImageFile> {
    const millis = toMillis(timestamp);
    const cached = this.thumbnailCache.get(millis) || this.fullScreenshotCache.get(millis);
    if (cached) {
      return cached.image;
    }
    return this.getScreenshot(timestamp, THUMBNAIL_SIZE)
      .then(s => {
        this.thumbnailCache.add(s);
        return s.image;
      });
  }

  private async saveImageFile(
    timestamp: string | null,
    size: number,
    img: Buffer,
  ): Promise<string> {
    const timestampStr = timestamp ? sanitizeTimestamp(timestamp) : Date.now();
    const fileName = `${timestampStr}_${size}.png`;
    await this.saveFile(fileName, img);
    return fileName;
  }

  private async saveFile(fileName: string, data: unknown): Promise<void> {
    if (!this.dir) {
      throw new Error('Server used before starting');
    }
    const filePath = path.join(this.dir, fileName);
    return await fs.writeFile(filePath, data, { encoding: 'hex' });
  }

  private getUrl(fileName: string): string {
    return `/${this.dirName}/${fileName}`;
  }

  public getPathFromUrl(url: string): string {
    if (!this.dir) {
      throw new Error('Server used before starting');
    }
    return url.replace(`/${this.dirName}`, this.dir);
  }

  private async cacheReplay(): Promise<void> {
    // TODO: 'SaveReplayBuffer' doesn't wait until the file written to resolve, so we'll need to
    // figure out something else here.
    return this.obsWs.send('SaveReplayBuffer')
      .catch(() => logger.debug('Attempted to cache replay, but replays not enabled'))
      .then(delay(1000))
      .then(this.getLatestReplay.bind(this))
      .then(r => { r && this.addReplayToCache(r); });
  }

  private async getLatestReplay(): Promise<string | null> {
    if (!this.recordingFolder) {
      return null;
    }
    return fs.readdir(this.recordingFolder)
      .then(files => files
        .filter(f => f.startsWith(obs.OBS_REPLAY_PREFIX))
        .map(f => path.join(this.recordingFolder || '', f))
        .slice(-1)[0] ||
        null);
  }

  private async addReplayToCache(filePath: string): Promise<void> {
    if (!this.dir) {
      throw new Error('Server used before starting');
    }
    const filename = path.basename(filePath);
    const nowMs = Date.now();
    const [ timestamp, fileStats, videoStats ] = await Promise.all([
      obs.getRecordingTimestamp(this.obsWs),
      fs.stat(filePath),
      ffmpeg.getVideoStats(filePath)
    ]);
    if (!timestamp || !fileStats || !videoStats) {
      return;
    }
    const endMillis = toMillis(timestamp) - (nowMs - Math.trunc(fileStats.birthtimeMs));
    const startMillis = endMillis - videoStats.durationMs;
    const replay: Replay = {
      video: { url: this.getUrl(filename), type: 'video' },
      startMillis,
      endMillis,
    };
    // TODO: Consider copying the file first
    fs.copyFile(filePath, path.join(this.dir, filename));
    this.replayCache.add(replay);
  }
}
