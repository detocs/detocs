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

import { getConfig } from '../../util/config';
import * as ffmpeg from '../../util/ffmpeg';
import { pngDataUri } from '../../util/image';
import * as obsUtil from '../../util/obs';
import { sanitizeTimestamp, validateTimestamp } from '../../util/timestamp';
import InfoState from '../info/state';
import { INFO_PORT } from "../ports";

import State from './state';
import SmashggClient from '../../util/smashgg';

interface ProcessInfo {
  pid: number;
  ppid?: number;
  uid?: number;
  gid?: number;
  name: string;
  cmd: string;
  bin: string;
}

interface Log {
  file: string;
  eventId?: string;
  phaseId?: string;
  start: string | null;
  end: string | null;
  sets: {
    id?: string;
    displayName?: string;
    start: string;
    end: string;
    state: InfoState;
  }[];
}

interface UpdateRequest {
  'start-timestamp'?: string;
  'stop-timestamp'?: string;
}

const obs = new ObsWebSocket();
let socketServer: ws.Server | null = null;
let smashgg: SmashggClient | null = null;
let currentLog: Log | null = null;
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
  obsUtil.connect(obs, async () => {
    logger.info('Connected to OBS');
    if (await obsUtil.isRecording(obs)) {
      getRecordingFile();
    }
  });

  smashgg = new SmashggClient();

  const app = express();
  // TODO: Security?
  app.use(cors());
  app.use(formidable());
  app.get('/start', startClip);
  app.post('/start', startClip);
  app.get('/stop', stopClip);
  app.post('/stop', stopClip);
  app.get('/save', save);
  app.post('/save', save);
  app.post('/update', update);

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
};

async function update(req: Request, res: Response): Promise<void> {
  if (!state.recordingFile) {
    res.sendStatus(400);
    return;
  }
  const fields = req.fields as UpdateRequest;
  const start = fields['start-timestamp'] || null;
  const stop = fields['stop-timestamp'] || null;
  let startChanged = false;
  let stopChanged = false;
  if (start && !validateTimestamp(start)) {
    res.sendStatus(400);
    return;
  }
  if (stop && !validateTimestamp(stop)) {
    res.sendStatus(400);
    return;
  }
  if (start != state.startTimestamp) {
    state.startThumbnail = null;
    startChanged = true;
  }
  if (stop != state.stopTimestamp) {
    state.stopThumbnail = null;
    stopChanged = true;
  }
  state.startTimestamp = start;
  state.stopTimestamp = stop;
  res.sendStatus(200);
  broadcastState(state);
  if (startChanged) {
    getThumbnailForStartTimestamp();
  }
  if (stopChanged) {
    getThumbnailForStopTimestamp();
  }
}

async function save(_: Request, res: Response): Promise<void> {
  if (!state.recordingFile || !state.recordingFolder) {
    logger.warn('Attempted to save clip before starting recording in OBS');
    res.sendStatus(400);
    return;
  }
  if (!state.startTimestamp || !state.stopTimestamp) {
    logger.warn('Attempted to save clip with start and end time');
    res.sendStatus(400);
    return;
  }

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
    const listeners = await find('port', getConfig().obsWebsocketPort);
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
  //await ffmpeg.trimClip(sourceFile, start, end, videoOutputPath);

  if (!currentLog || info.phaseId != currentLog.phaseId) {
    let eventId;
    if (info.phaseId && smashgg) {
      eventId = await smashgg.eventIdForPhase(info.phaseId);
    }
    currentLog = {
      file: sourceFile,
      eventId,
      phaseId: info.phaseId,
      start,
      end: null,
      sets: [],
    };
  }
  currentLog.sets.push({
    id: info.set && info.set.id,
    displayName: info.set ? info.set.displayName : info.match.name,
    start,
    end,
    state: Object.assign({}, info, { unfinishedSets: undefined }),
  });

  const metadataFolder = path.join(folder, sourceFilename);
  const metadataFilename =
    `${subFolder}-${info.phaseId || ''}-${sanitizeTimestamp(currentLog.start as string)}`;
  const metadataOutputPath = path.join(metadataFolder, metadataFilename + '.json');
  saveMetadata(currentLog as Log, metadataOutputPath);
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

function saveMetadata(log: Log, outFile: string): void {
  fs.writeFileSync(outFile, JSON.stringify(log, null, 2));
}

async function getThumbnailForStartTimestamp(): Promise<void> {
  if (!state.recordingFile || !state.startTimestamp) {
    return;
  }
  const img = await ffmpeg.getVideoThumbnail(state.recordingFile, state.startTimestamp)
    .catch(logger.error);
  if (!img) {
    return;
  }
  state.startThumbnail = pngDataUri(img);
  broadcastState(state);
}

async function getThumbnailForStopTimestamp(): Promise<void> {
  if (!state.recordingFile || !state.stopTimestamp) {
    return;
  }
  const img = await ffmpeg.getVideoThumbnail(state.recordingFile, state.stopTimestamp)
    .catch(logger.error);
  if (!img) {
    return;
  }
  state.stopThumbnail = pngDataUri(img);
  broadcastState(state);
}

function getInfo(): Promise<InfoState> {
  return fetch(`http://localhost:${INFO_PORT}/state`)
    .then(resp => resp.json());
}
