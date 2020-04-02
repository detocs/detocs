import find from 'find-process';
import { promises as fs, statSync } from 'fs';
import ObsWebSocket from 'obs-websocket-js';
import { dirname, extname, isAbsolute, join, basename } from 'path';

import { Timestamp } from '../models/timestamp';

import { getConfig } from './config';

// TODO: Get actual replay prefix from OBS
export const OBS_REPLAY_PREFIX = 'Replay';

export async function isRecording(obs: ObsWebSocket): Promise<boolean> {
  const resp = await obs.send('GetStreamingStatus');
  return resp['recording'] || false;
}

export async function getRecordingTimestamp(obs: ObsWebSocket): Promise<Timestamp | null> {
  const resp = await obs.send('GetStreamingStatus');
  return resp['rec-timecode'] || null;
}

export async function getRecordingFolder(obs: ObsWebSocket): Promise<string> {
  const resp = await obs.send('GetRecordingFolder');
  return resp['rec-folder'];
}

export async function getCurrentThumbnail(
  obs: ObsWebSocket,
  dimensions: { height?: number; width?: number },
): Promise<string> {
  const sceneResp = await obs.send('GetCurrentScene');
  if (!sceneResp) {
    throw new Error('GetCurrentScene failed');
  }
  const resp = await obs.send('TakeSourceScreenshot', {
    sourceName: sceneResp['name'],
    embedPictureFormat: 'png',
    ...dimensions,
  });
  if (!resp) {
    throw new Error('TakeSourceScreenshot failed');
  }
  return resp['img'];
}

export async function getOutputDimensions(
  obs: ObsWebSocket,
): Promise<{ width: number; height: number }> {
  const resp = await obs.send('GetVideoInfo');
  return { width: resp.outputWidth, height: resp.outputHeight };
}

// TODO: make async?
export function connect(obs: ObsWebSocket, callback: () => void): void {
  obs.connect({ address: `localhost:${getConfig().obsWebsocketPort}` })
    .then(callback)
    .catch(() => {
      //logger.warn('Unable to connect to OBS:', error);
      setTimeout(() => {
        connect(obs, callback);
      }, 10000);
    });
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
  let folder = await getRecordingFolder(obsWs);
  if (!isAbsolute(folder)) {
    // Some super cool guy is using relative paths with OBS
    const listeners = await find('port', getConfig().obsWebsocketPort);
    if (listeners.length) {
      folder = join(dirname((listeners[0] as ProcessInfo).bin), folder);
    }
  }

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
