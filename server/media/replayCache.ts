import { Replay } from '@models/media';

export class ReplayCache {
  private readonly leniency: number;
  private readonly replays: Required<Replay>[] = [];

  public constructor(leniency: number) {
    this.leniency = leniency;
  }

  public get(timestamp: number): Required<Replay> | null {
    // TODO: Optimize if we actually need to deal with a large number of replays
    return this.replays.find(r => {
      return r.startMs - this.leniency <= timestamp &&
        r.endMs + this.leniency >= timestamp;
    }) || null;
  }

  public add(r: Replay): void {
    if (!hasTimestamps(r)) {
      return;
    }
    this.replays.push(r);
  }
}
function hasTimestamps(r: Replay): r is Required<Replay> {
  return r.startMs != null && r.endMs != null;
}
