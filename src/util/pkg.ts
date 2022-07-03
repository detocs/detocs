import { chmodSync, copyFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

import { tmpDir } from '@util/fs';
import { getLogger } from '@util/logger';

const logger = getLogger('util/pkg');
const SNAPSHOT_REGEX = /^(?:C:\\|\/)snapshot(.+)/;

export function copyBundledFile(path: string): string {
  const match = SNAPSHOT_REGEX.exec(path);
  if (!match) {
    return path;
  }
  const dstPath = tmpDir(match[1]);
  mkdirSync(dirname(dstPath), { recursive: true });
  logger.debug(`Copying ${path} to ${dstPath}`);
  copyFileSync(path, dstPath);
  chmodSync(dstPath, 0o774);
  return dstPath;
}
