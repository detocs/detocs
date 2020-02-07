import { getLogger } from 'log4js';
const logger = getLogger('server/media');
logger.error = logger.error.bind(logger);

import { promises as fs } from 'fs';
import ObsWebSocket from 'obs-websocket-js';
import { join } from 'path';

import { Timestamp } from '../../models/timestamp';
import * as ffmpeg from '../../util/ffmpeg';
import { tmpDir } from '../../util/fs';
import * as obs from '../../util/obs';
import { sanitizeTimestamp, toMillis } from '../../util/timestamp';

const THUMBNAIL_SIZE = 135;

export interface MediaFile {
  url: string;
  type: string;
}

export type ImageFile = MediaFile & {
  type: 'image';
  height: number;
};

export type VideoFile = MediaFile & {
  type: 'video';
};

interface Screenshot {
  image: ImageFile;
  timestampMillis?: number;
}

export class MediaServer {
  private readonly obsWs = new ObsWebSocket();
  private readonly dirName: string;
  private dir: string | undefined;
  private isConnected = false;
  private streamWidth = 0;
  private streamHeight = 0;
  private recordingFile?: string;
  private fullScreenshots: Screenshot[] = [];
  private thumbnails: Screenshot[] = [];

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
    const { file } = await obs.getRecordingFile(this.obsWs);
    // TODO: FFmpeg cannot operate on certain file types while they're still being written (e.g.
    // mp4). We should handle this somehow.
    this.recordingFile = file;
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
        this.fullScreenshots.push(s);
        return s.image;
      });
  }

  public async getFullScreenshot(timestamp: Timestamp): Promise<ImageFile> {
    return this.getScreenshot(timestamp, this.streamHeight)
      .then(s => {
        this.fullScreenshots.push(s);
        return s.image;
      });
  }

  public async getCurrentThumbnail(): Promise<ImageFile> {
    return this.getCurrentScreenshot(THUMBNAIL_SIZE)
      .then(s => {
        this.thumbnails.push(s);
        return s.image;
      });
  }

  public async getThumbnail(timestamp: Timestamp): Promise<ImageFile> {
    return this.getScreenshot(timestamp, THUMBNAIL_SIZE)
      .then(s => {
        this.thumbnails.push(s);
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
    const filePath = join(this.dir, fileName);
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
}
