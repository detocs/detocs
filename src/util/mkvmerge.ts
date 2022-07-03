import { execFile } from 'child_process';
import { platform } from 'os';
import { promisify } from 'util';

import { Timestamp } from '@models/timestamp';
import { KeyframeSource } from '@util/keyframe-source';
import { getLogger } from '@util/logger';
import { copyBundledFile } from '@util/pkg';

const logger = getLogger('util/mkvmerge');
const pExecFile = promisify(execFile);

const MKVMERGE_BIN = (platform() === 'linux'
  ? import('mkvmerge-static-linux')
  : import('mkvmerge-static'))
  .then(module => module.path)
  .then(copyBundledFile);

export async function trimVideo(
  keyframeSource: KeyframeSource,
  sourceFile: string,
  start: Timestamp,
  end: Timestamp,
  outFile: string,
): Promise<void> {
  const startKeyframe = keyframeSource.closestPrecedingKeyframe(start);
  const endKeyframe = keyframeSource.closestSubsequentKeyframe(end);
  logger.debug(`Choosing keyframe ${startKeyframe} for timestamp ${start}`);
  logger.debug(`Choosing keyframe ${endKeyframe} for timestamp ${end}`);
  logger.info(
    `Cutting ${startKeyframe} to ${endKeyframe} from ${sourceFile}, saving to ${outFile}`);
  const args = [
    '--verbose',
    '--output', outFile,
    '--split', `parts:${startKeyframe}-${endKeyframe}`,
    sourceFile,
  ];
  const { stdout, stderr } = await pExecFile(await MKVMERGE_BIN, args);
  if (stdout) {
    logger.debug(stdout);
  }
  if (stderr) {
    logger.warn(stderr);
  }
}
