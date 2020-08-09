import { promises as fs } from 'fs';

import { SMASHGG_SERVICE_NAME } from '@services/smashgg/constants';

import { Log } from './types';

export async function loadLog(path: string): Promise<Log> {
  const log: Log = JSON.parse(await fs.readFile(path, { encoding: 'utf8' }));
  backfillServiceName(log);
  return log;
}

// Backwards compatibility
// TODO: Make an actual system for this once there's more than one
// backwards-incompatible change
function backfillServiceName(log: Log): void {
  if (!log.format) {
    log.bracketService = SMASHGG_SERVICE_NAME;
  }
}
