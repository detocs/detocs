import find from 'find-process';
import { promises as fs, statSync } from 'fs';
import ObsWebSocket, { ObsError } from 'obs-websocket-js';
import { dirname, extname, isAbsolute, join, basename } from 'path';

import { Timestamp } from '@models/timestamp';
import { sleep } from '@util/async';
import { getConfig } from '@util/configuration/config';
import { getLogger } from '@util/logger';

const logger = getLogger('services/obs');
const MIN_RECONNECTION_DELAY = 3 * 1000;
const MAX_RECONNECTION_DELAY = 5 * 60 * 1000;
const RECONNECTION_DELAY_GROWTH = 2;
const MAX_RECONNECTION_ATTEMPTS = 25;

// TODO: Get actual replay prefix from OBS
export const OBS_REPLAY_PREFIX = 'Replay';

export async function isRecording(obs: ObsWebSocket): Promise<boolean> {
  const resp = await obs.send('GetStreamingStatus')
    .catch(convertError);
  return resp['recording'] || false;
}

export async function getRecordingTimestamp(obs: ObsWebSocket): Promise<Timestamp | null> {
  const resp = await obs.send('GetStreamingStatus')
    .catch(convertError);
  return resp['rec-timecode'] || null;
}

export async function getRecordingFolder(obs: ObsWebSocket): Promise<string> {
  const resp = await obs.send('GetRecordingFolder')
    .catch(convertError);
  let folder = resp['rec-folder'];
  if (!isAbsolute(folder)) {
    // Some super cool guy is using relative paths with OBS
    const listeners = await find('port', getConfig().obsWebsocketPort);
    if (listeners.length) {
      folder = join(dirname((listeners[0] as ProcessInfo).bin), folder);
    }
  }
  return folder;
}

export async function getCurrentThumbnail(
  obs: ObsWebSocket,
  dimensions: { height?: number; width?: number },
): Promise<string> {
  const sceneResp = await obs.send('GetCurrentScene')
    .catch(convertError);
  if (!sceneResp) {
    throw new Error('GetCurrentScene failed');
  }
  const resp = await obs.send('TakeSourceScreenshot', {
    sourceName: sceneResp['name'],
    embedPictureFormat: 'png',
    ...dimensions,
  })
    .catch(convertError);
  if (!resp) {
    throw new Error('TakeSourceScreenshot failed');
  }
  return resp['img'];
}

export async function getOutputDimensions(
  obs: ObsWebSocket,
): Promise<{ width: number; height: number }> {
  const resp = await obs.send('GetVideoInfo')
    .catch(convertError);
  return { width: resp.outputWidth, height: resp.outputHeight };
}

export async function connect(obs: ObsWebSocket): Promise<void> {
  let delay = MIN_RECONNECTION_DELAY;
  for (let i = 0; i < MAX_RECONNECTION_ATTEMPTS; i++) {
    try {
      await obs.connect({ address: `localhost:${getConfig().obsWebsocketPort}` });
      obs.once('ConnectionClosed', () => {
        logger.warn('Disconnected from OBS');
        connect(obs);
      });
      logger.debug('Connected to OBS');
      return;
    } catch(error) {
      // logger.warn(`Unable to connect to OBS: ${error.description}`);
      await sleep(delay);
      delay = Math.min(MAX_RECONNECTION_DELAY, delay * RECONNECTION_DELAY_GROWTH);
    }
  }
  logger.error('Hit maximum number of OBS connection attempts');
}

interface ProcessInfo {
  pid: number;
  ppid?: number;
  uid?: number;
  gid?: number;
  name: string;
  cmd: string;
  bin: string;
}

export async function getRecordingFile(
  obsWs: ObsWebSocket,
): Promise<{ file: string; folder: string }> {
  const VIDEO_FILE_EXTENSIONS = ['.flv', '.mp4', '.mov', '.mkv', '.ts', '.m3u8'];
  const folder = await getRecordingFolder(obsWs);
  let files = await fs.readdir(folder);
  files = files.filter(f => VIDEO_FILE_EXTENSIONS.includes(extname(f)))
    .filter(f => !basename(f).startsWith(OBS_REPLAY_PREFIX));
  const timestamps = files.reduce((map: Map<string, number>, file: string) => {
    const stat = statSync(join(folder, file));
    map.set(file, stat.birthtimeMs);
    return map;
  }, new Map());
  files.sort((a: string, b: string) => (timestamps.get(a) || 0) - (timestamps.get(b) || 0));
  const file = join(folder, files.pop() || '');

  return { file, folder };
}

function convertError(obsError: ObsError): never {
  throw new Error(obsError.error);
}
