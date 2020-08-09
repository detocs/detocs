import { Replay } from '@models/media';

type TimestampedReplay = Replay & {
  recordingTimestampMs: number;
};

export class ReplayCache {
  private readonly leniency: number;
  private readonly replays: TimestampedReplay[] = [];

  public constructor(leniency: number) {
    this.leniency = leniency;
  }

  public get(timestamp: number): TimestampedReplay | null {
    // TODO: Optimize if we actually need to deal with a large number of replays
    return this.replays.find(r => {
      const startMs = r.recordingTimestampMs;
      const endMs = r.recordingTimestampMs + r.video.durationMs;
      return startMs - this.leniency <= timestamp &&
        endMs + this.leniency >= timestamp;
    }) || null;
  }

  public add(r: Replay): void {
    if (!hasTimestamps(r)) {
      return;
    }
    this.replays.push(r);
  }
}
function hasTimestamps(r: Replay): r is TimestampedReplay {
  return r.recordingTimestampMs != null;
}
