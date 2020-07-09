import { Screenshot } from '@models/media';

type TimestampedScreenshot = Screenshot & {
  recordingTimestampMs: number;
};

export class ScreenshotCache {
  private readonly leniency: number;
  private readonly screenshots: TimestampedScreenshot[] = [];

  public constructor(leniency: number) {
    this.leniency = leniency;
  }

  public get(timestamp: number): TimestampedScreenshot | null {
    // TODO: Optimize if we actually need to deal with a large number of screenshots
    return this.screenshots.find(s => {
      const diff = Math.abs(timestamp - s.recordingTimestampMs);
      return diff >= 0 && diff < this.leniency;
    }) || null;
  }

  public add(s: Screenshot): void {
    if (!hasTimestamp(s)) {
      return;
    }
    this.screenshots.push(s);
  }
}
function hasTimestamp(s: Screenshot): s is TimestampedScreenshot {
  return s.recordingTimestampMs != null;
}

