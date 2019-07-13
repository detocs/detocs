import log4js from 'log4js';
const logger = log4js.getLogger('server/recording');
logger.error = logger.error.bind(logger);

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

import * as ffmpeg from '../../util/ffmpeg';
import * as obsUtil from '../../util/obs';
import { sanitizeTimestamp } from '../../util/timestamp';
import InfoState from '../info/state';
import { INFO_PORT } from "../ports";

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

  obs.on('error' as any, logger.error); // eslint-disable-line @typescript-eslint/no-explicit-any
  // The recording file doesn't appear immediately
  obs.on('RecordingStarted', () => setTimeout(getRecordingFile, 2000));
  connect(obs, async () => {
    if (await obsUtil.isRecording(obs)) {
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
  const timestamp = await obsUtil.getRecordingTimestamp(obs).catch(logger.error);
  if (!timestamp) {
    logger.warn('Unable to get start timestamp');
    res.sendStatus(500);
    return;
  }

  state.startTimestamp = timestamp;
  logger.debug(`Starting clip at ${state.startTimestamp}`);
  res.sendStatus(200);

  obsUtil.getCurrentThumbnail(obs).then(img => {
    state.startThumbnail = img;
    broadcastState(state);
  }).catch(logger.error);

  state.stopTimestamp = null;
  state.stopThumbnail = null;
  state.clipFile = null;
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
  const timestamp = await obsUtil.getRecordingTimestamp(obs).catch(logger.error);
  if (!timestamp) {
    logger.warn('Unable to get stop timestamp');
    res.sendStatus(500);
    return;
  }

  state.stopTimestamp = timestamp;
  logger.debug(`Stopping clip at ${state.stopTimestamp}`);
  res.sendStatus(200);
  broadcastState(state);

  obsUtil.getCurrentThumbnail(obs).then(img => {
    state.stopThumbnail = img;
    broadcastState(state);
  }).catch(logger.error);

  saveRecording(
    state.recordingFolder,
    state.recordingFile,
    state.startTimestamp,
    state.stopTimestamp,
  ).then(file => {
    state.clipFile = file;
    broadcastState(state);
  }).catch(logger.error);
};

async function getRecordingFile(): Promise<void> {
  const VIDEO_FILE_EXTENSIONS = ['.flv', '.mp4', '.mov', '.mkv', '.ts', '.m3u8'];
  let folder = await obsUtil.getRecordingFolder(obs);
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
  await ffmpeg.trimClip(sourceFile, start, end, videoOutputPath);

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
  const matchSummary = info.match.id ? ` - ${info.match.id}` : '';
  return filenamify(`${start} - ${end}${gameSummary}${matchSummary}${playerSummary}`);
}

function saveMetadata(info: InfoState, outFile: string): void {
  fs.writeFileSync(outFile, JSON.stringify(info, null, 2));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getThumbnailForStartTimestamp(): Promise<void> {
  if (!state.recordingFile || !state.startTimestamp) {
    return;
  }
  const img = await ffmpeg.getVideoThumbnail(state.recordingFile, state.startTimestamp);
  state.startThumbnail = base64Png(img);
  broadcastState(state);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getThumbnailForStopTimestamp(): Promise<void> {
  if (!state.recordingFile || !state.stopTimestamp) {
    return;
  }
  const img = await ffmpeg.getVideoThumbnail(state.recordingFile, state.stopTimestamp);
  state.stopThumbnail = base64Png(img);
  broadcastState(state);
}

function base64Png(image: Buffer): string {
  return `data:image/png;base64,${image.toString('base64')}`;
}

function getInfo(): Promise<InfoState> {
  return fetch(`http://localhost:${INFO_PORT}/state`)
    .then(resp => resp.json());
}
