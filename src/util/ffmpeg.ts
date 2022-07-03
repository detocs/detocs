import { execFile } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import path from 'path';
import { promisify } from 'util';

import { Timestamp } from '@models/timestamp';
import { getConfig } from '@util/configuration/config';
import { getLogger } from '@util/logger';
import * as pathUtil from '@util/path';
import { copyBundledFile } from '@util/pkg';

export interface VideoStats {
  durationMs?: number;
}

const logger = getLogger('util/ffmpeg');
const pExecFile = promisify(execFile);
export const WAVEFORM_HEIGHT = 80;
export const FFMPEG_BIN = copyBundledFile(ffmpegStatic);
export const FFPROBE_BIN = copyBundledFile(ffprobeStatic.path);
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
  logger.debug(FFMPEG_BIN, args.join(' '));
  const { stderr } = await pExecFile(FFMPEG_BIN, args);
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
  const {
    transcodeVideoInputArgs,
    transcodeVideoOutputArgs,
  } = getConfig().ffmpeg;
  const args = [
    '-ss', start,
    '-to', end,
    ...transcodeVideoInputArgs,
    '-i', sourceFile,
    '-ss', '0',
    '-codec:a', 'copy',
    ...transcodeVideoOutputArgs,
    '-y',
    outFile,
  ];
  logger.debug(FFMPEG_BIN, args.join(' '));
  const { stderr } = await pExecFile(FFMPEG_BIN, args);
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
  logger.debug(FFMPEG_BIN, args.join(' '));
  const hrstart = process.hrtime();
  const { stdout, stderr } = await pExecFile(FFMPEG_BIN, args, { encoding: 'buffer' });
  const hrend = process.hrtime(hrstart);
  if (stderr.length) {
    logger.debug(stderr.toString());
  }
  logger.debug(`Getting frame took ${hrend[0]}s ${hrend[1] / 1e6}ms`);
  return stdout;
}

export async function getVideoStats(file: string): Promise<VideoStats> {
  const durationRegex = /duration=([\d.]+|N\/A)/;
  const args = [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1',
    file,
  ];
  logger.debug(FFPROBE_BIN, args.join(' '));
  const { stdout, stderr } = await pExecFile(FFPROBE_BIN, args, { encoding: 'utf8' });
  const match = durationRegex.exec(stdout.trim());
  if (stderr.length && !match) {
    throw new Error(stderr);
  } else if (!match) {
    throw new Error(`Unexpected output when getting stats for ${file}: ${stdout}`);
  } else if (stderr.length) {
    // Some errors, like "co located POCs unavailable" don't seem to affect our
    // stats, so if the output looks fine ignore them
    logger.warn(`Non-fatal error when getting stats for ${file}: ${stderr}`);
  }

  if (match[1] === 'N/A') {
    return {
      durationMs: undefined,
    };
  }

  const seconds = +match[1];
  return {
    durationMs: Math.trunc(seconds * 1000),
  };
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
    '-y',
    outFile,
  ];
  logger.debug(FFMPEG_BIN, args.join(' '));
  const { stderr } = await pExecFile(FFMPEG_BIN, args);
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
  logger.debug(FFMPEG_BIN, args.join(' '));
  const { stderr } = await pExecFile(FFMPEG_BIN, args);
  if (stderr) {
    logger.debug(stderr);
  }
}

export async function getKeyframes(file: string): Promise<Timestamp[]> {
  const args = [
    '-v', 'error',
    '-select_streams', 'v',
    '-skip_frame', 'nokey',
    '-show_entries', 'frame=pkt_pts_time',
    '-sexagesimal',
    '-print_format', 'csv=p=0',
    file,
  ];
  logger.debug(FFPROBE_BIN, args.join(' '));
  const { stdout, stderr } = await pExecFile(FFPROBE_BIN, args, { encoding: 'utf8' });
  if (stderr.length) {
    throw new Error(stderr);
  }
  // TODO: Sort keyframes? They should be monotonic, but you never know...
  return parseKeyframes(stdout);
}

export function parseKeyframes(stdout: string): Timestamp[] {
  return stdout.trim()
    .split('\n')
    .map(t => {
      const padded = t + '000';
      const dotIndex = padded.indexOf('.');
      return padded.substring(0, dotIndex + 4);
    });
}
