import log4js from 'log4js';
const logger = log4js.getLogger('server/recording');
logger.error = logger.error.bind(logger);

import cors from 'cors';
import express, { Request, Response } from 'express';
import formidable from 'express-formidable';
import filenamify from 'filenamify';
import find from 'find-process';
import fs from 'fs';
import { createServer } from 'http';
import ObsWebSocket from 'obs-websocket-js';
import path from 'path';
import { promisify } from 'util';
import * as ws from 'ws';

import { getConfig } from '../../util/config';
import * as ffmpeg from '../../util/ffmpeg';
import { pngDataUri } from '../../util/image';
import * as obsUtil from '../../util/obs';
import { sanitizeTimestamp, validateTimestamp } from '../../util/timestamp';
import InfoState from '../info/state';
import { INFO_PORT } from "../ports";

import State, { Recording } from './state';
import SmashggClient from '../../util/smashgg';
import uuidv4 from '../../util/uuid';
import RecordingLogger from './log';

const asyncMkdir = promisify(fs.mkdir);

interface ProcessInfo {
  pid: number;
  ppid?: number;
  uid?: number;
  gid?: number;
  name: string;
  cmd: string;
  bin: string;
}

interface UpdateRequest {
  'id'?: string;
  'start-timestamp'?: string;
  'stop-timestamp'?: string;
}

const obs = new ObsWebSocket();
let socketServer: ws.Server | null = null;
let recordingLogger: RecordingLogger | null = null;
const state: State = {
  streamRecordingFolder: null,
  streamRecordingFile: null,
  recordings: [],
};


export default function start(port: number): void {
  logger.info('Initializing match recording server');

  obs.on('error' as any, logger.error); // eslint-disable-line @typescript-eslint/no-explicit-any
  // The recording file doesn't appear immediately
  obs.on('RecordingStarted', () => setTimeout(getRecordingFile, 2000));
  obs.on('RecordingStopping', stopInProgressRecording);
  obsUtil.connect(obs, async () => {
    logger.info('Connected to OBS');
    if (await obsUtil.isRecording(obs)) {
      getRecordingFile();
    }
  });

  recordingLogger = new RecordingLogger(new SmashggClient());

  const app = express();
  // TODO: Security?
  app.use(cors());
  app.use(formidable());
  app.get('/start', startRecording);
  app.post('/start', startRecording);
  app.get('/stop', stopRecordingHandler);
  app.post('/stop', stopRecordingHandler);
  app.post('/update', updateRecording);
  app.post('/cut', cutRecording);

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

function saveLogs(state: State): void {
  if (!recordingLogger) {
    return;
  }
  recordingLogger.saveLogs(state);
}

async function startRecording(_req: Request, res: Response): Promise<void> {
  if (!state.streamRecordingFile || !state.streamRecordingFolder) {
    sendUserError(res, 'Attempted to start recording before starting stream recording');
    return;
  }
  const timestamp = await obsUtil.getRecordingTimestamp(obs).catch(logger.error);
  if (!timestamp) {
    logger.warn('Unable to get start timestamp');
    res.sendStatus(500);
    return;
  }

  let recording = state.recordings[0];
  if (!recording || recording.stopTimestamp) {
    recording = newRecording(state.streamRecordingFile, timestamp);
    state.recordings.unshift(recording);
  } else {
    recording.startTimestamp = timestamp;
  }
  logger.debug(`Starting clip at ${timestamp}`);
  res.sendStatus(200);
  broadcastState(state);
  saveLogs(state);
  getCurrentThumbnail(recording.id, 'startThumbnail');
};

async function stopRecordingHandler(_: Request, res: Response): Promise<void> {
  if (!state.streamRecordingFile || !state.streamRecordingFolder) {
    sendUserError(res, 'Attempted to stop recording before starting stream recording');
    return;
  }
  if (!state.recordings[0]?.startTimestamp) {
    sendUserError(res, 'Attempted to stop recording before starting');
    return;
  }

  await stopRecording(() => res.sendStatus(200))
    .catch((err: Error) => sendServerError(res, err.message));
}

async function stopInProgressRecording(): Promise<void> {
  if (!state.recordings[0]?.startTimestamp || state.recordings[0].stopTimestamp) {
    return;
  }

  await stopRecording().catch(logger.error);
}

async function stopRecording(callback?: Function): Promise<void> {
  const timestamp = await obsUtil.getRecordingTimestamp(obs).catch(logger.error);
  if (!timestamp) {
    throw new Error('Unable to get stop timestamp');
  }

  const recordingId = state.recordings[0].id;
  state.recordings[0].stopTimestamp = timestamp;
  logger.debug(`Stopping clip at ${timestamp}`);
  callback && callback();
  broadcastState(state);
  saveLogs(state);
  getCurrentThumbnail(recordingId, 'stopThumbnail');
  setMetadata(recordingId);
}

async function setMetadata(recordingId: string): Promise<void> {
  const info = await getInfo();
  if (!info) {
    return;
  }
  const recording = getRecordingById(recordingId);
  if (recording == null) {
    logger.error(`Recording with id ${recordingId} no longer present`);
    return;
  }

  Object.assign(info, { unfinishedSets: undefined });
  recording.displayName = info.set ? info.set.displayName : info.match.name,
  recording.metadata = info;
  broadcastState(state);
  saveLogs(state);
}

function getCurrentThumbnail(
  recordingId: string,
  thumbnailProp: 'startThumbnail' | 'stopThumbnail',
): Promise<void> {
  return obsUtil.getCurrentThumbnail(obs).then(img => {
    const recording = getRecordingById(recordingId);
    if (!recording) {
      return;
    }
    recording[thumbnailProp] = img;
    broadcastState(state);
  }).catch(logger.error);
}

async function updateRecording(req: Request, res: Response): Promise<void> {
  const fields = req.fields as UpdateRequest;
  const recordingId = fields['id'];
  const start = fields['start-timestamp'] || null;
  const stop = fields['stop-timestamp'] || null;
  if (recordingId == null) {
    sendUserError(res, 'No recording ID provided');
    return;
  }
  const recording = getRecordingById(recordingId);
  if (recording == null) {
    sendUserError(res, 'No recording matches provided ID');
    return;
  }
  if ((start && !validateTimestamp(start)) ||
    (stop && !validateTimestamp(stop)))
  {
    sendUserError(res, 'Invalid timestamp');
    return;
  }

  if (start && start != recording.startTimestamp) {
    recording.startTimestamp = start;
    recording.startThumbnail = null;
    getThumbnailForTimestamp(recordingId, 'startTimestamp', 'startThumbnail');
  }
  if (stop != recording.stopTimestamp) {
    recording.stopTimestamp = stop;
    recording.stopThumbnail = null;
    getThumbnailForTimestamp(recordingId, 'stopTimestamp', 'stopThumbnail');
  }
  res.sendStatus(200);
  broadcastState(state);
  saveLogs(state);
}

async function cutRecording(req: Request, res: Response): Promise<void> {
  if (!state.streamRecordingFile || !state.streamRecordingFolder) {
    sendUserError(res, 'Attempted to cut recording before starting stream recording');
    return;
  }
  const recordingId = req.fields && req.fields['id'];
  if (recordingId == null || typeof recordingId != 'string') {
    sendUserError(res, 'No recording ID provided');
    return;
  }
  const recording = getRecordingById(recordingId);
  if (recording == null) {
    sendUserError(res, 'No recording matches provided ID');
    return;
  }
  if (!recording.startTimestamp || !recording.stopTimestamp || !recording.streamRecordingFile) {
    sendUserError(res, 'Attempted to save recording without start time, end time, and file');
    return;
  }
  if (!recording.metadata) {
    sendUserError(res, 'Attempted to save recording without metadata');
    return;
  }

  saveRecording(
    state.streamRecordingFolder,
    recording.streamRecordingFile,
    recording.startTimestamp,
    recording.stopTimestamp,
    recording.metadata,
  ).then(file => {
    const recording = getRecordingById(recordingId);
    if (!recording) {
      return;
    }
    recording.recordingFile = file;
    broadcastState(state);
  }).catch(logger.error);
};

async function getRecordingFile(): Promise<void> {
  const VIDEO_FILE_EXTENSIONS = ['.flv', '.mp4', '.mov', '.mkv', '.ts', '.m3u8'];
  let folder = await obsUtil.getRecordingFolder(obs);
  if (!path.isAbsolute(folder)) {
    // Some super cool guy is using relative paths with OBS
    const listeners = await find('port', getConfig().obsWebsocketPort);
    if (listeners.length) {
      folder = path.join(path.dirname((listeners[0] as ProcessInfo).bin), folder);
    }
  }
  state.streamRecordingFolder = folder;
  logger.info(`Recording folder: ${state.streamRecordingFolder}`);

  let files = fs.readdirSync(folder);
  files = files.filter(f => VIDEO_FILE_EXTENSIONS.includes(path.extname(f)));
  const timestamps = files.reduce((map: Map<string, number>, file: string) => {
    map.set(file, fs.statSync(path.join(folder, file)).birthtimeMs);
    return map;
  }, new Map());
  files.sort((a: string, b: string) => (timestamps.get(a) || 0) - (timestamps.get(b) || 0));
  state.streamRecordingFile = path.join(folder, files.pop() || '');
  logger.info(`Recording file: ${state.streamRecordingFile}`);
}

async function saveRecording(
  folder: string,
  sourceFile: string,
  start: string,
  end: string,
  metadata: InfoState,
): Promise<string | null> {
  const extension = path.extname(sourceFile);
  const sourceFilename = path.basename(sourceFile, extension);
  const outputFilename = generateFilename(start, end, metadata);

  const subFolder = metadata.game.id || 'recordings';
  const outputFolder = path.join(folder, sourceFilename, subFolder);
  await asyncMkdir(outputFolder, { recursive: true });

  const videoOutputPath = path.join(outputFolder, outputFilename + extension);
  await ffmpeg.trimClip(sourceFile, start, end, videoOutputPath);
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

async function getThumbnailForTimestamp(
  recordingId: string,
  timestampProp: 'startTimestamp' | 'stopTimestamp',
  thumbnailProp: 'startThumbnail' | 'stopThumbnail',
): Promise<void> {
  let recording = getRecordingById(recordingId);
  if (recording == null) {
    logger.error(`Recording with id ${recordingId} no longer present`);
    return;
  }
  const timestamp = recording[timestampProp];
  if (!recording.streamRecordingFile || !timestamp) {
    logger.warn('Recording missing stream recording file or timestamp');
    return;
  }
  const img = await ffmpeg.getVideoThumbnail(recording.streamRecordingFile, timestamp)
    .catch(logger.error);
  if (!img) {
    return;
  }
  recording = getRecordingById(recordingId);
  if (recording == null) {
    logger.error(`Recording with id ${recordingId} no longer present`);
    return;
  }
  recording[thumbnailProp] = pngDataUri(img);
  broadcastState(state);
}

function getInfo(): Promise<InfoState> {
  return fetch(`http://localhost:${INFO_PORT}/state`)
    .then(resp => resp.json());
}

function newRecording(streamRecordingFile: string, startTimestamp: string): Recording {
  return {
    id: uuidv4(),
    streamRecordingFile: streamRecordingFile,
    recordingFile: null,
    startTimestamp: startTimestamp,
    stopTimestamp: null,
    startThumbnail: null,
    stopThumbnail: null,
    displayName: null,
    metadata: null,
  };
}

function getRecordingById(id: string): Recording | undefined {
  return state.recordings.find(r => r.id === id);
}

function sendUserError(res: express.Response, msg: string): void {
  logger.warn(msg);
  res.status(400).send(msg);
}

function sendServerError(res: express.Response, msg: string): void {
  logger.error(msg);
  res.status(500).send(msg);
}
