import { promises as fs } from 'fs';

import { SMASHGG_SERVICE_NAME } from '@services/smashgg/constants';

import { Log } from './types';

export async function loadLog(path: string): Promise<Log> {
  const log: Log = JSON.parse(await fs.readFile(path, { encoding: 'utf8' }));
  backfillServiceName(log);
  return log;
}

// Backwards compatibility
function backfillServiceName(log: Log): void {
  if (!log.version) {
    log.bracketService = SMASHGG_SERVICE_NAME;
  }
}
