import log4js from 'log4js';
const logger = log4js.getLogger('server/recording');

import { execSync } from 'child_process';
import cors from 'cors';
import express, { Request, Response } from 'express';
import formidable from 'express-formidable';
import filenamify from 'filenamify';
import find from 'find-process';
import fs from 'fs';
import { createServer, Server } from 'http';
import ObsWebSocket from 'obs-websocket-js';
import path from 'path';
import * as ws from 'ws';

import InfoState from '../info/state';
import { INFO_PORT } from "../ports";

import State from './state';
import { sanitizeTimestamp } from '../../util/timestamp';

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

const obs = new ObsWebSocket();
let socketServer: ws.Server | null = null;
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

  const app = express();
  // TODO: Security?
  app.use(cors());
  app.use(formidable());
  app.get('/start', startClip);
  app.get('/stop', stopClip);

  const httpServer = createServer(app);
  socketServer = new ws.Server({
    server: httpServer,
  });
  socketServer.on('connection', function connection(client): void {
    client.send(JSON.stringify(state));
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
  //logger.debug('Broadcasting state: ', state);
  socketServer.clients.forEach(client => {
    if (client.readyState === ws.OPEN) {
      client.send(JSON.stringify(state));
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

  state.startThumbnail = await getCurrentThumbnail();
  broadcastState(state);
};

async function stopClip(_: Request, res: Response): Promise<void> {
  if (!state.recordingFile || !state.recordingFolder) {
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

  state.clipFile = await saveRecording(
    state.recordingFolder,
    state.recordingFile,
    state.startTimestamp,
    state.stopTimestamp,
  );
  res.sendStatus(200);
  broadcastState(state);

  state.stopThumbnail = await getCurrentThumbnail();
  broadcastState(state);
};

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

async function saveRecording(
  folder: string,
  sourceFile: string,
  start: string,
  end: string
): Promise<string | null> {
  const info = await getInfo();
  if (!info) {
    return null;
  }
  const subFolder = info.game.id || 'clips';
  const extension = path.extname(sourceFile);
  const sourceFilename = path.basename(sourceFile, extension);
  const outputFilename = generateFilename(start, end, info);

  const outputFolder = path.join(folder, sourceFilename, subFolder);
  fs.mkdirSync(outputFolder, { recursive: true });

  const videoOutputPath = path.join(outputFolder, outputFilename + extension);
  trimClip(sourceFile, start, end, videoOutputPath);

  const metadataOutputPath = path.join(outputFolder, outputFilename + '.json');
  saveMetadata(info, metadataOutputPath);
  return videoOutputPath;
}

function generateFilename(start: string, end: string, info: InfoState): string {
  start = sanitizeTimestamp(start);
  end = sanitizeTimestamp(end);
  let playerSummary = '';
  if (info.players.length) {
    playerSummary = ' - ' + info.players
      .map(p => p.person.handle)
      .join(', ');
  }
  const gameSummary = info.game.id ? ` - ${info.game.id}` : '';
  const matchSummary = info.match ? ` - ${info.match}` : '';
  return filenamify(`${start} - ${end}${gameSummary}${matchSummary}${playerSummary}`);
}

function trimClip(sourceFile: string, start: string, end: string, outFile: string): void {
  const command = [
    'ffmpeg',
    `-ss ${start}`,
    `-i "${sourceFile}"`,
    `-to ${end}`,
    '-codec copy -avoid_negative_ts 1',
    `"${outFile}"`,
  ].join(' ');
  logger.debug(command);
  execSync(command);
}

function saveMetadata(info: InfoState, outFile: string): void {
  fs.writeFileSync(outFile, JSON.stringify(info, null, 2));
}

async function isRecording(): Promise<boolean> {
  const resp = await obs.send('GetStreamingStatus');
  return resp['recording'] || false;
}

async function getRecordingTimestamp(): Promise<string | null> {
  const resp = await obs.send('GetStreamingStatus');
  return resp['rec-timecode'] || null;
}

async function getCurrentThumbnail(): Promise<string | null> {
  const sceneResp = await obs.send('GetCurrentScene')
    .catch(logger.error.bind(logger));
  if (!sceneResp) {
    return null;
  }
  const resp = await obs.send('TakeSourceScreenshot' as any, {
    'sourceName': sceneResp['name'],
    'embedPictureFormat': 'png',
    'width': 240,
    'height': 135,
  }).catch(logger.error.bind(logger));
  return resp ? resp['img'] as string : null;
}

function getThumbnailForStartTimestamp(): void {
  if (!state.recordingFile || !state.startTimestamp) {
    return;
  }
  state.startThumbnail = base64Png(getVideoThumbnail(state.recordingFile, state.startTimestamp));
  broadcastState(state);
}

function getThumbnailForStopTimestamp(): void {
  if (!state.recordingFile || !state.stopTimestamp) {
    return;
  }
  state.stopThumbnail = base64Png(getVideoThumbnail(state.recordingFile, state.stopTimestamp));
  broadcastState(state);
}

function getVideoThumbnail(file: string, timestamp: string): Buffer {
  const command = [
    'ffmpeg',
    `-ss ${timestamp}`,
    `-i "${file}"`,
    '-frames:v 1 -codec:v png -f rawvideo -filter:v scale="240:-1" -an',
    'pipe:',
  ].join(' ');
  logger.debug(command);
  const img = execSync(command);
  return img;
}

function base64Png(image: Buffer): string {
  return `data:image/png;base64,${image.toString('base64')}`;
}

function getInfo(): Promise<InfoState> {
  return fetch(`http://localhost:${INFO_PORT}/state`)
    .then(resp => resp.json());
}
