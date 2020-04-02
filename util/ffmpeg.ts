import log4js from 'log4js';
const logger = log4js.getLogger('util/ffmpeg');

import { execFile } from 'child_process';
import { promisify } from 'util';

interface VideoStats {
  durationMs: number; // ms
}

const pExecFile = promisify(execFile);
const FFMPEG_COMMAND = 'ffmpeg';
const FFPROBE_COMMAND = 'ffprobe';

export async function trimClip(
  sourceFile: string,
  start: string,
  end: string,
  outFile: string
): Promise<void> {
  const args = [
    '-ss', start,
    '-to', end,
    '-i', sourceFile,
    '-codec', 'copy',
    '-avoid_negative_ts', '1',
    outFile,
  ];
  logger.debug(FFMPEG_COMMAND, args.join(' '));
  const { stderr } = await pExecFile(FFMPEG_COMMAND, args);
  if (stderr) {
    logger.debug(stderr);
  }
}

/**
 * @param file 
 * @param timestamp 
 * @param dimensions One of width or height must be set (for now)
 */
export async function getVideoFrame(
  file: string,
  timestamp: string,
  dimensions: { width?: number; height?: number } = {},
): Promise<Buffer> {
  const args = [
    '-ss', timestamp,
    '-noaccurate_seek',
    '-an',
    '-i', file,
    '-frames:v', '1',
    '-codec:v', 'png',
    '-f', 'rawvideo',
    '-filter:v', `scale=${dimensions.width || -1}:${dimensions.height || -1}`,
    'pipe:',
  ];
  logger.debug(FFMPEG_COMMAND, args.join(' '));
  const hrstart = process.hrtime();
  const { stdout, stderr } = await pExecFile(FFMPEG_COMMAND, args, { encoding: 'buffer' });
  const hrend = process.hrtime(hrstart);
  if (stderr.length) {
    logger.debug(stderr.toString());
  }
  logger.debug(`Getting frame took ${hrend[0]}s ${hrend[1] / 1e6}ms`);
  return stdout;
}

export async function getVideoStats(file: string): Promise<VideoStats> {
  const args = [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file,
  ];
  logger.debug(FFPROBE_COMMAND, args.join(' '));
  const { stdout, stderr } = await pExecFile(FFPROBE_COMMAND, args, { encoding: 'utf8' });
  if (stderr.length) {
    logger.warn(stderr.toString());
  }
  const durationStr = stdout.trim();
  const seconds = +durationStr;
  if (isNaN(seconds)) {
    throw new Error(`Unable to parse duration ${durationStr}`);
  }
  return {
    durationMs: Math.trunc(seconds * 1000),
  };
}
