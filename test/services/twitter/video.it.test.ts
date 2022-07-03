import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';

import TwitterClient, { ApiTwitterClient, MockTwitterClient } from '@services/twitter/twitter';
import { loadCredentials, getCredentials } from '@util/configuration/credentials';
import { FFMPEG_BIN } from '@util/ffmpeg';

const EXAMPLE_FILE_FOLDER = path.resolve('temp-twitter-test-files');
const pExecFile = promisify(execFile);
let twitterClient: TwitterClient = new MockTwitterClient();

describe(twitterClient.tweet, () => {
  beforeAll(async () => {
    await twitterLogin();
    await createTempFolder();
  });

  it('can upload a small video file', async () => {
    const filename = 'small.mp4';
    const mediaPath = tempFile(filename);

    // Smaller than max chunk size
    await generateTestVideo(mediaPath, 256 * 1024);

    await twitterClient.tweet('', null, mediaPath);
  }, 5 * 60 * 1000);

  it('can upload a large video file', async () => {
    const filename = 'large.mp4';
    const mediaPath = tempFile(filename);

    // Larger than max chunk size
    await generateStatic(mediaPath, 11 * 1024 * 1024);

    await twitterClient.tweet('', null, mediaPath);
  }, 5 * 60 * 1000);

  afterAll(cleanupTempFiles);
});


async function twitterLogin(): Promise<void> {
  try {
    await loadCredentials();
    const { twitterKey, twitterSecret } = getCredentials();
    if (!twitterKey || !twitterSecret) {
      console.error('Twitter API keys not found');
      process.exit();
    }
    twitterClient = new ApiTwitterClient(twitterKey, twitterSecret);
    const accessToken = getCredentials().twitterToken;
    if (!accessToken) {
      console.error('Twitter token not found. Please log in before running this test.');
      process.exit();
    }
    await twitterClient.logIn(accessToken);
    if (!twitterClient.isLoggedIn()) {
      console.error('Logging in failed somehow');
      process.exit();
    }
  } catch(err) {
    console.error('Logging in failed somehow', err);
    process.exit();
  }
}

async function generateTestVideo(mediaPath: string, fileSize: number): Promise<void> {
  await pExecFile(FFMPEG_BIN, [
    '-f', 'lavfi',
    '-i', 'testsrc=size=1920x1080:rate=60',
    '-vf', 'format=yuv420p',
    '-fs', `${fileSize}`,
    mediaPath,
  ]);
}

async function generateStatic(mediaPath: string, fileSize: number): Promise<void> {
  await pExecFile(FFMPEG_BIN, [
    '-f', 'lavfi',
    '-i', 'nullsrc=s=1920x1080',
    '-filter_complex', 'geq=random(1)*255:128:128;aevalsrc=-2+random(0)',
    '-crf', '38',
    '-fs', `${fileSize}`,
    mediaPath,
  ]);
}

function tempFile(filename: string): string {
  return path.join(EXAMPLE_FILE_FOLDER, filename);
}

async function createTempFolder(): Promise<void> {
  try {
    await fs.mkdir(EXAMPLE_FILE_FOLDER, { recursive: false });
  } catch(err) {
    console.error('Failed to create temp file folder', err);
    process.exit();
  }
}

async function cleanupTempFiles(): Promise<void> {
  try {
    await fs.rmdir(EXAMPLE_FILE_FOLDER, {
      recursive: true,
    });
  } catch(err) {
    console.error('Failed to delete temp file folder', err);
    process.exit();
  }
}
