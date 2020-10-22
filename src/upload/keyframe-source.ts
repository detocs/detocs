import { Timestamp } from '@models/timestamp';
import { getKeyframes } from '@util/ffmpeg';
import {
  closestPrecedingKeyframe,
  closestSubsequentKeyframe,
  closestPrecedingKeyframeFromInterval,
  closestSubsequentKeyframeFromInterval,
} from '@util/keyframes';

import { toMillis } from '@util/timestamp';

type FileOrInterval = {
  file: string;
} | {
  intervalMs: number;
};

export class KeyframeSource {
  private fileOrInterval: FileOrInterval;
  private keyframesMs: number[] = [];

  public constructor(fileOrInterval: FileOrInterval) {
    this.fileOrInterval = fileOrInterval;
  }

  public async init(): Promise<void> {
    if ('file' in this.fileOrInterval) {
      this.keyframesMs = await getKeyframes(this.fileOrInterval.file)
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
