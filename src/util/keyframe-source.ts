import { promises as fs } from 'fs';
import { join, basename } from 'path';

import { Timestamp } from '@models/timestamp';
import { getKeyframes } from '@util/ffmpeg';
import {
  closestPrecedingKeyframe,
  closestSubsequentKeyframe,
  closestPrecedingKeyframeFromInterval,
  closestSubsequentKeyframeFromInterval,
} from '@util/keyframes';
import { getLogger } from '@util/logger';
import { toMillis } from '@util/timestamp';

type FileOrInterval = {
  file: string;
  outputDir: string;
} | {
  intervalMs: number;
};

const logger = getLogger('keyframe-source');

export class KeyframeSource {
  private fileOrInterval: FileOrInterval;
  private keyframesMs: number[] = [];

  public constructor(fileOrInterval: FileOrInterval) {
    this.fileOrInterval = fileOrInterval;
  }

  public async init(): Promise<void> {
    if ('file' in this.fileOrInterval) {
      const file = this.fileOrInterval.file;
      const filename = basename(file);
      const cacheFile = join(this.fileOrInterval.outputDir, filename + '.keyframes.txt');
      this.keyframesMs = await fs.readFile(cacheFile, { encoding: 'utf8' })
        .then(
          parseKeyframeFile.bind(null, cacheFile),
          () => fetchKeyframes(file).then(writeKeyframeFile.bind(null, cacheFile)),
        )
        .then(timestamps => timestamps.map(toMillis));
    }
  }

  public closestPrecedingKeyframe(timestamp: Timestamp): Timestamp {
    if ('file' in this.fileOrInterval) {
      return closestPrecedingKeyframe(this.keyframesMs, timestamp);
    } else {
      return closestPrecedingKeyframeFromInterval(this.fileOrInterval.intervalMs, timestamp);
    }
  }

  public closestSubsequentKeyframe(timestamp: Timestamp): Timestamp {
    if ('file' in this.fileOrInterval) {
      return closestSubsequentKeyframe(this.keyframesMs, timestamp);
    } else {
      return closestSubsequentKeyframeFromInterval(this.fileOrInterval.intervalMs, timestamp);
    }
  }
}

function fetchKeyframes(filepath: string): Promise<string[]> {
  logger.info(`Reading keyframes from ${filepath} (this might take a while)`);
  return getKeyframes(filepath);
}

function parseKeyframeFile(filepath: string, str: string): string[] {
  logger.info(`Loading keyframes from ${filepath}`);
  return str.trim().split('\n');
}

function writeKeyframeFile(filepath: string, timestamps: string[]): Promise<string[]> {
  logger.info(`Saving keyframes to ${filepath}`);
  return fs.writeFile(filepath, timestamps.join('\n'))
    .then(() => timestamps);
}
