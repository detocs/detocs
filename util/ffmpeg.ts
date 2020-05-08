import log4js from 'log4js';
const logger = log4js.getLogger('util/ffmpeg');

import { execFile } from 'child_process';
import path from 'path';
import { promisify } from 'util';

import * as pathUtil from './path';

export interface VideoStats {
  durationMs?: number;
}

const pExecFile = promisify(execFile);
const FFMPEG_COMMAND = 'ffmpeg';
const FFPROBE_COMMAND = 'ffprobe';
export const WAVEFORM_HEIGHT = 80;
const WAVEFORM_PIXELS_PER_MS = 0.06; // 1 pixel per frame
const WAVEFORM_MAX_WIDTH = 1920;

export async function losslessCut(
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
    '-y',
    outFile,
  ];
  logger.debug(FFMPEG_COMMAND, args.join(' '));
  const { stderr } = await pExecFile(FFMPEG_COMMAND, args);
  if (stderr) {
    logger.debug(stderr);
  }
}

export async function lossyCut(
  sourceFile: string,
  start: string,
  end: string,
  outFile: string
): Promise<void> {
  const args = [
    '-ss', start,
    '-to', end,
    '-i', sourceFile,
    '-ss', '0',
    '-codec:v', 'libx264',
    '-crf', '18',
    '-codec:a', 'copy',
    '-threads', '2',
    '-y',
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
    '-v', 'warning',
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
    throw new Error(stderr);
  }
  const durationStr = stdout.trim();
  const seconds = +durationStr;
  if (isNaN(seconds)) {
    return {
      durationMs: undefined,
    };
  } else {
    return {
      durationMs: Math.trunc(seconds * 1000),
    };
  }
}

/**
 * Browsers won't play MKVs, because that would make life too easy
 * 
 * @param sourceFile The source file path
 * @param outDir The output directory
 * @returns A promise that resolves to the path of the output file
 */
export async function copyToWebCompatibleFormat(
  sourceFile: string,
  outDir: string,
): Promise<string> {
  // TODO: Analyze media streams to determine if conversion is even necessary,
  // and what the output container should be.
  const outputExt = '.mp4';
  const outFile = path.join(
    outDir,
    pathUtil.withoutExtension(sourceFile) + outputExt,
  );
  const args = [
    '-v', 'warning',
    '-i', sourceFile,
    '-codec', 'copy',
    outFile,
  ];
  logger.debug(FFMPEG_COMMAND, args.join(' '));
  const { stderr } = await pExecFile(FFMPEG_COMMAND, args);
  if (stderr) {
    logger.debug(stderr);
  }
  return outFile;
}

export async function getWaveform(
  sourceFile: string,
  outFile: string,
  durationMs: number,
): Promise<void> {
  const width = Math.min(
    WAVEFORM_MAX_WIDTH,
    Math.trunc(durationMs * WAVEFORM_PIXELS_PER_MS),
  );
  const args = [
    '-v', 'warning',
    '-i', sourceFile,
    `-filter_complex`,
    `showwavespic=s=${width}x${WAVEFORM_HEIGHT}:scale=sqrt:colors=#ffffff|#ffffff`,
    '-frames:v', '1',
    '-y',
    outFile,
  ];
  logger.debug(FFMPEG_COMMAND, args.join(' '));
  const { stderr } = await pExecFile(FFMPEG_COMMAND, args);
  if (stderr) {
    logger.debug(stderr);
  }
}
