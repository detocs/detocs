import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import assert from 'assert';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';

import {
  copyToWebCompatibleFormat,
  FFMPEG_BIN,
  getKeyframes,
  getVideoFrame,
  getVideoStats,
  getWaveform,
  losslessCut,
  lossyCut,
} from '@util/ffmpeg.ts';
import { parseHeight, parseWidth } from '@util/png.ts';

const TEMP_DIR = path.resolve('ffmpeg-test-files');
const TEST_VIDEO = path.join(TEMP_DIR, 'test-video.mkv');
const pExecFile = promisify(execFile);

beforeAll(async () => {
  await createTempFolder();
  await generateTestVideo(TEST_VIDEO, 10);
});

afterAll(async () => {
  await cleanupTempFiles();
});

describe(losslessCut, () => {
  it('cuts on keyframes', async () => {
    const output = path.join(TEMP_DIR, 'lossless-cut.mp4');
    await losslessCut(TEST_VIDEO, '0:00:03.200', '0:00:07.700', output);
    const { durationMs } = await getVideoStats(output);
    expect(durationMs).toBeGreaterThanOrEqual(5700);
  });
});

describe(lossyCut, () => {
  it('uses exact duration', async () => {
    const output = path.join(TEMP_DIR, 'lossy-cut.mp4');
    await lossyCut(TEST_VIDEO, '0:00:02.200', '0:00:07.700', output);
    const { durationMs } = await getVideoStats(output);
    expect(durationMs).toBeGreaterThanOrEqual(5500);
    expect(durationMs).toBeLessThanOrEqual(5517);
  });
});

describe(getVideoFrame, () => {
  it('defaults to video dimensions', async () => {
    const frame = await getVideoFrame(TEST_VIDEO, '0:00:05.000');
    const width = parseWidth(frame);
    const height = parseHeight(frame);
    expect(width).toBe(1920);
    expect(height).toBe(1080);
  });

  it('can resize output', async () => {
    const frame = await getVideoFrame(TEST_VIDEO, '0:00:05.000', { width: 640, height: 360 });
    const width = parseWidth(frame);
    const height = parseHeight(frame);
    expect(width).toBe(640);
    expect(height).toBe(360);
  });
});

describe(getVideoStats, () => {
  it('parses duration', async () => {
    const { durationMs } = await getVideoStats(TEST_VIDEO);
    expect(durationMs).toBe(10000);
  });
});

describe(copyToWebCompatibleFormat, () => {
  it('copies and converts to mp4', async () => {
    const outputPath = await copyToWebCompatibleFormat(TEST_VIDEO, TEMP_DIR);
    expect(path.extname(outputPath)).toBe('.mp4');
  });
});

describe(getWaveform, () => {
  it('generates 1 pixel per frame', async () => {
    const { durationMs } = await getVideoStats(TEST_VIDEO);
    assert(durationMs);
    const imgPath = TEST_VIDEO + '.waveform.png';
    const outputPath = await getWaveform(TEST_VIDEO, imgPath, durationMs);
    const pngData = await fs.readFile(imgPath);
    expect(parseWidth(pngData)).toBe(durationMs / 1000 * 60);
  });
});

describe(getKeyframes, () => {
  it('parses keyframe timestamps', async () => {
    const keyframes = await getKeyframes(TEST_VIDEO);
    expect(keyframes).toEqual([
      '0:00:00.000',
      '0:00:02.000',
      '0:00:04.000',
      '0:00:06.000',
      '0:00:08.000',
    ]);
  });
});

async function generateTestVideo(mediaPath: string, duration: number): Promise<void> {
  const { stderr } = await pExecFile(FFMPEG_BIN, [
    '-v', 'error',
    '-f', 'lavfi',
    '-i', `color=c=white:size=1920x1080:d=${duration}:r=60`,
    '-itsoffset',  '1',
    '-f', 'lavfi',
    '-i', `anoisesrc=d=${duration}:c=pink:r=48000:a=0.1`,
    '-vf', `drawtext=text='%{pts\\:hms}':x=10:y=10:fontsize=256:fontcolor=black`,
    '-r', '60',
    '-g', '120',
    '-keyint_min', '120',
    '-sc_threshold', '0',
    '-shortest',
    mediaPath,
  ]);
}

async function createTempFolder(): Promise<void> {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: false });
  } catch(err) {
    throw new Error(`Failed to create temp file folder: ${err}`);
  }
}

async function cleanupTempFiles(): Promise<void> {
  try {
    const tempFiles = await fs.readdir(TEMP_DIR);
    await Promise.all(tempFiles.map(file => fs.unlink(path.join(TEMP_DIR, file))));
    await fs.rmdir(TEMP_DIR, {
      recursive: true,
    });
  } catch(err) {
    throw new Error(`Failed to delete temp file folder: ${err}`);
  }
}
