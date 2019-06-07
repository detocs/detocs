import log4js from 'log4js';
const logger = log4js.getLogger('server/recording');

import { execSync } from 'child_process';
import cors from 'cors';
import express, { Request, Response } from 'express';
import formidable from 'express-formidable';
import find from 'find-process';
import fs from 'fs';
import { Server } from 'http';
import moment from 'moment';
import ObsWebSocket from 'obs-websocket-js';
import path from 'path';
import * as ws from 'ws';

import State from './state';

interface ProcessInfo{
  pid: number;
  ppid?: number;
  uid?: number;
  gid?: number;
  name: string;
  cmd: string;
  bin: string;
}

const OBS_WEBSOCKET_PORT = 4444;
const SCREENSHOT_TIMEOUT = 2000;

const obs = new ObsWebSocket();
const socketServer: ws.Server | null = null;
const state: State = {
  recordingFolder: null,
  recordingFile: null,
  clipFile: null,
  startTimestamp: null,
  stopTimestamp: null,
  startThumbnail: null,
  stopThumbnail: null,
};

export default function start(port: number): void {
  logger.info('Initializing match recording server');

  obs.on('error' as any, logger.error);
  // The recording file doesn't appear immediately
  obs.on('RecordingStarted', () => setTimeout(getRecordingFile, 2000));
  connect(obs, async () => {
    if (await isRecording()) {
      getRecordingFile();
    }
  });

  const httpServer = express();
  // TODO: Security?
  httpServer.use(cors());
  httpServer.use(formidable());
  httpServer.get('/start', startClip);
  httpServer.get('/stop', stopClip);

  const socketServer = new ws.Server({
    server: httpServer as unknown as Server,
  });
  socketServer.on('connection', function connection(ws): void {
    ws.send(state);
    logger.info('Websocket connection received');
  });

  httpServer.listen(port, () => logger.info(`Listening on port ${port}`));
};

function connect(obs: ObsWebSocket, callback: () => void): void {
  obs.connect({ address: `localhost:${OBS_WEBSOCKET_PORT}` })
    .then(() => {
      logger.info('Connected to OBS');
      callback();
    })
    .catch((error) => {
      logger.warn('Unable to connect to OBS:', error);
      setTimeout(() => {
        connect(obs, callback);
      }, 10000);
    });
}

function broadcastState(state: State): void {
  if (!socketServer) {
    return;
  }
  socketServer.clients.forEach(client => {
    if (client.readyState === ws.OPEN) {
      client.send(state);
    }
  });
}

async function startClip(_req: Request, res: Response): Promise<void> {
  if (!state.recordingFile) {
    logger.warn('Attempted to start clip before starting recording in OBS');
    res.sendStatus(400);
    return;
  }
  state.startTimestamp = await getRecordingTimestamp();
  if (!state.startTimestamp) {
    logger.warn('Unable to get start timestamp');
    res.sendStatus(500);
    return;
  }
  logger.debug(`Starting clip at ${state.startTimestamp}`);
  state.stopTimestamp = null;
  state.clipFile = null;
  res.sendStatus(200);
  broadcastState(state);

  setTimeout(() => {
    if (!state.recordingFile || !state.startTimestamp) {
      return;
    }
    state.startThumbnail = base64Png(
      getPreviewScreenshot(state.recordingFile, state.startTimestamp));
    broadcastState(state);
  }, SCREENSHOT_TIMEOUT);
};

async function stopClip(_req: Request, res: Response): Promise<void> {
  if (!state.recordingFile) {
    logger.warn('Attempted to stop clip before starting recording in OBS');
    res.sendStatus(400);
    return;
  }
  if (!state.startTimestamp) {
    logger.warn('Attempted to stop clip before starting clip');
    res.sendStatus(400);
    return;
  }
  state.stopTimestamp = await getRecordingTimestamp();
  if (!state.stopTimestamp) {
    logger.warn('Unable to get stop timestamp');
    res.sendStatus(500);
    return;
  }
  logger.debug(`Stopping clip at ${state.stopTimestamp}`);
  state.clipFile = trimClip(state.recordingFile, state.startTimestamp, state.stopTimestamp);
  res.sendStatus(200);
  broadcastState(state);

  setTimeout(() => {
    if (!state.recordingFile || !state.stopTimestamp) {
      return;
    }
    state.stopThumbnail = base64Png(
      getPreviewScreenshot(state.recordingFile, state.stopTimestamp));
    broadcastState(state);
  }, SCREENSHOT_TIMEOUT);
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getRecordingFile(): Promise<void> {
  const VIDEO_FILE_EXTENSIONS = ['.flv', '.mp4', '.mov', '.mkv', '.ts', '.m3u8'];
  const resp = await obs.send('GetRecordingFolder');
  let folder = resp['rec-folder'];
  if (!path.isAbsolute(folder)) {
    // Some super cool guy is using relative paths with OBS
    const listeners = await find('port', OBS_WEBSOCKET_PORT);
    if (listeners.length) {
      folder = path.join(path.dirname((listeners[0] as ProcessInfo).bin), folder);
    }
  }
  state.recordingFolder = folder;
  logger.info(`Recording folder: ${state.recordingFolder}`);

  let files = fs.readdirSync(folder);
  files = files.filter(f => VIDEO_FILE_EXTENSIONS.includes(path.extname(f)));
  const timestamps = files.reduce((map: Map<string, number>, file: string) => {
    map.set(file, fs.statSync(path.join(folder, file)).birthtimeMs);
    return map;
  }, new Map());
  files.sort((a: string, b: string) => (timestamps.get(a) || 0) - (timestamps.get(b) || 0));
  state.recordingFile = path.join(folder, files.pop() || '');
  logger.info(`Recording file: ${state.recordingFile}`);
}

function trimClip(file: string, start: string, end: string): string | null {
  if (!state.recordingFolder) {
    return null;
  }
  const outputName = `${sanitizeFilename(start)} - ${sanitizeFilename(end)}${path.extname(file)}`;
  const outputPath = path.join(state.recordingFolder, outputName);
  const command = [
    'ffmpeg',
    `-ss ${start}`,
    `-i "${file}"`,
    `-to ${end}`,
    '-c copy -avoid_negative_ts 1',
    `"${outputPath}"`,
  ].join(' ');
  logger.debug(command);
  execSync(command);
  return outputPath;
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/:/g, '-');
}

async function isRecording(): Promise<boolean> {
  const resp = await obs.send('GetStreamingStatus');
  return resp['recording'] || false;
}

async function getRecordingTimestamp(): Promise<string | null> {
  const resp = await obs.send('GetStreamingStatus');
  return resp['rec-timecode'] || null;
}

function getPreviewScreenshot(file: string, timestamp: string): Buffer {
  logger.debug(timestamp);
  const command = [
    'ffmpeg',
    `-ss ${timestamp} -noaccurate_seek`,
    `-i "${file}"`,
    '-frames:v 1 -c:v png -f rawvideo -filter:v scale="240:-1"',
    'pipe:',
  ].join(' ');
  logger.debug(command);
  const img = execSync(command);
  return img;
}

function base64Png(image: Buffer): string {
  return `data:image/png;base64,${image.toString('base64')}`;
}

function offsetTimestamp(timestamp: string, offsetSeconds: number): string {
  const TIMESTAMP_FORMAT = 'HH:mm:ss.SSS';
  const time = moment(timestamp, TIMESTAMP_FORMAT);
  time.add(offsetSeconds, 'seconds');
  return time.format(TIMESTAMP_FORMAT);
}
