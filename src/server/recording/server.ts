import cors from 'cors';
import express, { Request, Response } from 'express';
import formidable from 'express-formidable';
import filenamify from 'filenamify';
import fs from 'fs';
import { createServer } from 'http';
import { combine } from 'neverthrow';
import path from 'path';
import { promisify } from 'util';
import * as ws from 'ws';

import { getPrefixedNameWithAlias } from '@models/person';
import InfoState from '@server/info/state';
import { MediaServer } from '@server/media/server';
import { INFO_PORT } from '@server/ports';
import BracketServiceProvider from '@services/bracket-service-provider';
import ObsClient from '@services/obs/obs';
import * as ffmpeg from '@util/ffmpeg';
import * as httpUtil from '@util/http-server';
import { getId } from '@util/id';
import { getLogger } from '@util/logger';
import { sanitizeTimestamp, validateTimestamp } from '@util/timestamp';

import RecordingLogger from './log';
import State, { Recording } from './state';

const logger = getLogger('server/recording');
const asyncMkdir = promisify(fs.mkdir);
const sendUserError = httpUtil.sendUserError.bind(null, logger);
const sendServerError = httpUtil.sendServerError.bind(null, logger);

interface UpdateRequest {
  'id'?: string;
  'start-timestamp'?: string;
  'stop-timestamp'?: string;
}

let obs: ObsClient | undefined;
let media: MediaServer | null = null;
let socketServer: ws.Server | null = null;
let recordingLogger: RecordingLogger | null = null;
const state: State = {
  recordings: [],
};


export default function start({ port, mediaServer, bracketProvider, obsClient }: {
  port: number;
  mediaServer: MediaServer;
  bracketProvider: BracketServiceProvider;
  obsClient: ObsClient;
}): void {
  logger.info('Initializing match recording server');

  obs = obsClient;
  media = mediaServer;

  obs.on('RecordingStopping', stopInProgressRecording);

  recordingLogger = new RecordingLogger(bracketProvider);

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

async function saveLogs(state: State): Promise<void> {
  return obs?.getRecordingFolder()
    .match(
      async folder => recordingLogger?.saveLogs(folder, state),
      logger.error,
    );
}

async function startRecording(_req: Request, res: Response): Promise<void> {
  const { folder, file } = await getRecordingFile();
  if (!file || !folder) {
    sendUserError(res, 'Attempted to start recording before starting stream recording');
    return;
  }
  const timestamps = await obs?.getTimestamps()
    .match(
      t => t,
      e => { throw e; },
    );
  if (!timestamps) {
    logger.error('Unable to get timestamp');
    res.sendStatus(500);
    return;
  }
  if (!timestamps.recordingTimestamp) {
    sendUserError(res, 'Attempted to start recording before starting stream recording');
    return;
  }
  const timestamp = timestamps.recordingTimestamp;

  let recording = state.recordings[0];
  if (!recording || recording.stopTimestamp) {
    recording = newRecording(file, timestamp);
    state.recordings.unshift(recording);
  } else {
    recording.startTimestamp = timestamp;
  }
  logger.debug(`Starting clip at ${timestamp}`);
  res.sendStatus(200);
  broadcastState(state);
  saveLogs(state);
  getCurrentThumbnail(recording.id, 'startThumbnail');
}

async function stopRecordingHandler(_: Request, res: Response): Promise<void> {
  const { folder, file } = await getRecordingFile();
  if (!file || !folder) {
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

async function stopRecording(callback?: () => void): Promise<void> {
  const timestamps = await obs?.getTimestamps()
    .match(
      t => t,
      e => { throw e; },
    );
  if (!timestamps || !timestamps.recordingTimestamp) {
    throw new Error('Unable to get stop timestamp');
  }

  const recordingId = state.recordings[0].id;
  state.recordings[0].stopTimestamp = timestamps.recordingTimestamp;
  logger.debug(`Stopping clip at ${timestamps.recordingTimestamp}`);
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
  recording.displayName = formatDisplayName(info);
  recording.metadata = info;
  broadcastState(state);
  saveLogs(state);
}

function getCurrentThumbnail(
  recordingId: string,
  thumbnailProp: 'startThumbnail' | 'stopThumbnail',
): Promise<void> {
  if (!media) {
    throw new Error('No media server');
  }
  return media.getCurrentThumbnail().then(screenshot => {
    const recording = getRecordingById(recordingId);
    if (!recording) {
      return;
    }
    recording[thumbnailProp] = screenshot.image;
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
  const { folder, file } = await getRecordingFile();
  if (!file || !folder) {
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
    folder,
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
}

async function getRecordingFile(): Promise<{ folder: string | null, file: string | null }> {
  if (!obs) {
    return { folder: null, file: null };
  }
  return combine([
    obs.getRecordingFolder(),
    obs.getRecordingFile(),
  ])
    .map(([ folder, file ]) => ({ folder, file }))
    .mapErr(logger.error)
    .unwrapOr({ folder: null, file: null });
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
  await ffmpeg.losslessCut(sourceFile, start, end, videoOutputPath);
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
  return media?.getThumbnail(timestamp)
    .match(
      screenshot => {
        recording = getRecordingById(recordingId);
        if (recording == null) {
          logger.error(`Recording with id ${recordingId} no longer present`);
          return;
        }
        recording[thumbnailProp] = screenshot.image;
        broadcastState(state);
      },
      logger.error,
    );
}

function getInfo(): Promise<InfoState> {
  return fetch(`http://localhost:${INFO_PORT}/state`)
    .then(resp => resp.json());
}

function formatDisplayName(info: InfoState): string {
  const matchDisp = [
    info.set?.shortIdentifier,
    info.match.id || info.match.name,
  ].filter(str => !!str).join(' - ');
  const playersDisp = info.players
    .map(p => p.person)
    .map(getPrefixedNameWithAlias)
    .filter(str => !!str)
    .join(' vs ');
  return [ matchDisp, playersDisp ].join(': ');
}

function newRecording(streamRecordingFile: string, startTimestamp: string): Recording {
  return {
    id: getId(),
    streamRecordingFile: streamRecordingFile,
    recordingFile: null,
    startTimestamp: startTimestamp,
    stopTimestamp: null,
    startThumbnail: null,
    stopThumbnail: null,
    displayName: 'Current Recording',
    metadata: null,
  };
}

function getRecordingById(id: string): Recording | undefined {
  return state.recordings.find(r => r.id === id);
}
