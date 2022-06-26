import { promises as fs } from 'fs';
import path from 'path';

import { SMASHGG_SERVICE_NAME } from '@services/smashgg/constants';

import { Log } from './types';

export async function loadLog(logPath: string): Promise<Log> {
  const log: Log = JSON.parse(await fs.readFile(logPath, { encoding: 'utf8' }));
  resolveRelativePaths(path.dirname(logPath), log);
  backfillServiceName(log);
  return log;
}

// Backwards compatibility
// TODO: Make an actual system for this once there's more than one
// backwards-incompatible change
function backfillServiceName(log: Log): void {
  if (!log.format && !log.bracketService) {
    log.bracketService = SMASHGG_SERVICE_NAME;
  }

}

function resolveRelativePaths(dir: string, log: Log): void {
  log.file = log.file && path.resolve(dir, log.file);
}
