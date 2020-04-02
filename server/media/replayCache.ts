import { Replay } from '../../models/media';

export class ReplayCache {
  private readonly leniency: number;
  private readonly replays: Required<Replay>[] = [];

  public constructor(leniency: number) {
    this.leniency = leniency;
  }

  public get(timestamp: number): Replay | null {
    // TODO: Optimize if we actually need to deal with a large number of replays
    return this.replays.find(r => {
      return r.startMillis - this.leniency <= timestamp &&
        r.endMillis + this.leniency >= timestamp;
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
  return r.startMillis != null && r.endMillis != null;
}
