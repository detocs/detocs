import cors from 'cors';
import express, { Request, Response } from 'express';
import formidable from 'express-formidable';
import filenamify from 'filenamify';
import fs from 'fs';
import { createServer } from 'http';
import { combine, err, errAsync, ok, okAsync, ResultAsync } from 'neverthrow';
import path from 'path';
import { promisify } from 'util';
import * as ws from 'ws';

import { getPrefixedNameWithAlias } from '@models/person';
import { Timestamp } from '@models/timestamp';
import InfoState from '@server/info/state';
import { MediaServer } from '@server/media/server';
import { INFO_PORT } from '@server/ports';
import BracketServiceProvider from '@services/bracket-service-provider';
import VisionMixer from '@services/vision-mixer-service';
import * as ffmpeg from '@util/ffmpeg';
import * as httpUtil from '@util/http-server';
import { getId } from '@util/id';
import { getLogger } from '@util/logger';
import { mostRecent } from '@util/recording';
import { combineAsync } from '@util/results';
import { compareTimestamp, sanitizeTimestamp, validateTimestamp } from '@util/timestamp';

import RecordingLogger from './log';
import State, { Recording, RecordingGroup } from './state';
import { getConfig } from '@util/configuration/config';

const logger = getLogger('server/recording');
const asyncMkdir = promisify(fs.mkdir);
const sendUserError = httpUtil.sendUserError.bind(null, logger);
const sendServerError = httpUtil.sendServerError.bind(null, logger);

interface UpdateRequest {
  'id'?: string;
  'start-timestamp'?: string;
  'stop-timestamp'?: string;
}

interface UpdateGroupRequest {
  'id'?: string;
  'start-timestamp'?: string;
  'stop-timestamp'?: string;
  'thumbnail-timestamp'?: string;
}

let visMixer: VisionMixer | undefined;
let media: MediaServer | null = null;
let socketServer: ws.Server | null = null;
let recordingLogger: RecordingLogger | null = null;
const state: State = {
  recordings: [],
  recordingGroups: [],
};


export default function start({ port, mediaServer, bracketProvider, visionMixer }: {
  port: number;
  mediaServer: MediaServer;
  bracketProvider: BracketServiceProvider;
  visionMixer: VisionMixer;
}): void {
  logger.info('Initializing match recording server');

  visMixer = visionMixer;
  media = mediaServer;

  visMixer.onRecordingStop(() => {
    stopInProgressRecording();
    stopInProgressRecordingGroup();
  });

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
  app.get('/startGroup', startRecordingGroup);
  app.post('/startGroup', startRecordingGroup);
  app.get('/endGroup', endRecordingGroup);
  app.post('/endGroup', endRecordingGroup);
  app.post('/updateGroup', updateRecordingGroup);

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
  socketServer.clients.forEach(client => {
    if (client.readyState === ws.OPEN) {
      client.send(JSON.stringify(state));
    }
  });
}

async function saveLogs(state: State): Promise<void> {
  return visMixer?.getRecordingFolder()
    .match(
      async folder => recordingLogger?.saveLogs(folder, state),
      logger.error,
    );
}

async function startRecording(_req: Request, res: Response): Promise<void> {
  getRecordingFileAndTimestamp()
    .map(
      ({ file, timestamp }) => {
        let recording = mostRecent(state.recordings);
        if (!recording || recording.stopTimestamp) {
          recording = newRecording(file, timestamp);
          state.recordings.push(recording);
          return recording;
        } else {
          recording.startTimestamp = timestamp;
          return recording;
        }
      }
    )
    .match(
      recording => {
        logger.debug(`Starting clip at ${recording.startTimestamp}`);
        res.sendStatus(200);
        broadcastState(state);
        saveLogs(state);
        getCurrentThumbnail('startThumbnail', () => getRecordingById(recording.id));
      },
      err => err.send(logger, res),
    );
}

async function stopRecordingHandler(_: Request, res: Response): Promise<void> {
  const { folder, file } = await getRecordingFile();
  if (!file || !folder) {
    sendUserError(res, 'Attempted to stop recording before starting stream recording');
    return;
  }
  if (!mostRecent(state.recordings)?.startTimestamp) {
    sendUserError(res, 'Attempted to stop recording before starting');
    return;
  }

  await stopRecording(() => res.sendStatus(200))
    .catch((err: Error) => sendServerError(res, err.message));
}

async function stopInProgressRecording(): Promise<void> {
  if (!mostRecent(state.recordings)?.startTimestamp ||
    mostRecent(state.recordings)?.stopTimestamp)
  {
    return;
  }

  await stopRecording().catch(logger.error);
}

async function stopRecording(callback?: () => void): Promise<void> {
  const timestamps = await visMixer?.getTimestamps()
    .match(
      t => t,
      e => { throw e; },
    );
  if (!timestamps || !timestamps.recordingTimestamp) {
    throw new Error('Unable to get stop timestamp');
  }

  const mostRecentRecording = mostRecent(state.recordings);
  if (!mostRecentRecording) {
    logger.error('Attempted to stop recording before starting');
    return;
  }
  const recordingId = mostRecentRecording.id;
  logger.debug(`Stopping clip at ${timestamps.recordingTimestamp}`);
  callback && callback();
  broadcastState(state);
  saveLogs(state);

  let createdGroup: RecordingGroup|undefined = undefined;
  getCurrentThumbnail('stopThumbnail', () => getRecordingById(recordingId), () => createdGroup);
  setMetadata(recordingId, timestamps.recordingTimestamp)
    .then(() => {
      if (!getConfig().recording.splitOnGameChange || state.recordings.length <= 1) {
        return;
      }

      const prevRecording = state.recordings[state.recordings.length - 2];
      const currRecording = state.recordings[state.recordings.length - 1];
      const prevStop = prevRecording.stopTimestamp;
      const currStart = currRecording.startTimestamp;
      if (!prevStop) {
        return;
      }

      const prevGame = prevRecording.metadata?.game;
      const currGame = currRecording.metadata?.game;
      const prevGameId = prevGame?.id || prevGame?.name;
      const currGameId = currGame?.id || currGame?.name;
      if (prevGameId === currGameId) {
        return;
      }

      if (state.recordingGroups.some(rg => {
        const vsPrev = compareTimestamp(rg.startTimestamp, prevStop);
        const vsCurr = compareTimestamp(rg.startTimestamp, currStart);

        return vsPrev >= 0 && vsCurr <= 0;
      })) {
        return;
      }

      logger.info(`Starting group at ${currStart} due to game change. Set splitOnGameChange to false to disable this behavior.`);
      const latestGroup = mostRecent(state.recordingGroups);
      if (latestGroup && !latestGroup?.stopTimestamp) {
        latestGroup.stopTimestamp = prevStop;
        latestGroup.stopThumbnail = prevRecording.stopThumbnail;
      }
      createdGroup = newRecordingGroup(currRecording.streamRecordingFile, currStart);
      createdGroup.startThumbnail = currRecording.startThumbnail;
      state.recordingGroups.push(createdGroup);
    });
}

async function setMetadata(recordingId: string, stopTimestamp: Timestamp): Promise<void> {
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
  recording.stopTimestamp = stopTimestamp;
  broadcastState(state);
  saveLogs(state);
}

function getCurrentThumbnail(
  thumbnailProp: 'startThumbnail' | 'stopThumbnail',
  ...locators: (() => (Recording|RecordingGroup|undefined))[]
): Promise<void> {
  if (!media) {
    throw new Error('No media server');
  }
  return media.getCurrentThumbnail().then(screenshot => {
    for (const locator of locators) {
      const recording = locator();
      if (!recording) {
        continue;
      }
      recording[thumbnailProp] = screenshot.image;
    }
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
  const locator = (): (Recording | undefined) => getRecordingById(recordingId);
  const recording = locator();
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
    getThumbnailForTimestamp(locator, 'startTimestamp', 'startThumbnail');
  }
  if (stop && stop != recording.stopTimestamp) {
    recording.stopTimestamp = stop;
    recording.stopThumbnail = null;
    getThumbnailForTimestamp(locator, 'stopTimestamp', 'stopThumbnail');
  }
  res.sendStatus(200);
  broadcastState(state);
  saveLogs(state);
}

async function cutRecording(req: Request, res: Response): Promise<void> {
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
    path.dirname(recording.streamRecordingFile),
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

  res.sendStatus(200);
}

async function startRecordingGroup(_req: Request, res: Response): Promise<void> {
  getRecordingFileAndTimestamp()
    .map(({ file, timestamp }) => {
      let recordingGroup = mostRecent(state.recordingGroups);
      if (!recordingGroup || recordingGroup.stopTimestamp) {
        recordingGroup = newRecordingGroup(file, timestamp);
        state.recordingGroups.push(recordingGroup);
        return recordingGroup;
      } else {
        recordingGroup.startTimestamp = timestamp;
        return recordingGroup;
      }
    })
    .match(
      (recordingGroup) => {
        logger.debug(`Starting group at ${recordingGroup.startTimestamp}`);
        res.sendStatus(200);
        broadcastState(state);
        saveLogs(state);
        getCurrentThumbnail('startThumbnail', () => getRecordingGroupById(recordingGroup.id));
      },
      err => err.send(logger, res),
    );
}

async function endRecordingGroup(_req: Request, res: Response): Promise<void> {
  getRecordingFileAndTimestamp().andThen<{
    timestamp: Timestamp;
    recordingGroup: RecordingGroup;
    recording: Recording|undefined;
  }>(data => {
    const mostRecentGroup = mostRecent(state.recordingGroups);
    const mostRecentRecording = mostRecent(state.recordings);
    if (!mostRecentGroup?.startTimestamp) {
      return err(httpUtil.userError('Attempted to stop recording group before starting'));
    }
    return ok({
      timestamp: data.timestamp,
      recordingGroup: mostRecentGroup,
      recording: mostRecentRecording,
    });
  })
    .match(
      ({ timestamp, recordingGroup, recording }) => {
        recordingGroup.stopTimestamp = timestamp;
        const recordingIdToUpdate =
          (recording && recording.startTimestamp && !recording.stopTimestamp)
            ? recording.id
            : null;
        if (recordingIdToUpdate && recording) {
          recording.stopTimestamp = timestamp;
        }
        logger.debug(`Ending group at ${timestamp}`);
        res.sendStatus(200);
        broadcastState(state);
        if (!recordingIdToUpdate) {
          saveLogs(state);
        }

        const groupId = recordingGroup.id;
        if (recordingIdToUpdate) {
          setMetadata(recordingIdToUpdate, timestamp);
          getCurrentThumbnail(
            'stopThumbnail',
            () => getRecordingGroupById(groupId),
            () => getRecordingById(recordingIdToUpdate),
          );
        } else {
          getCurrentThumbnail(
            'stopThumbnail',
            () => getRecordingGroupById(groupId),
          );
        }
      },
      err => err.send(logger, res),
    );
}

async function stopInProgressRecordingGroup(): Promise<void> {
  const mostRecentGroup = mostRecent(state.recordingGroups);
  if (!mostRecentGroup?.startTimestamp || mostRecentGroup.stopTimestamp) {
    return;
  }
  return getRecordingFileAndTimestamp()
    .match(
      ({ timestamp }) => {
        const groupId = mostRecentGroup.id;
        mostRecentGroup.stopTimestamp = timestamp;
        logger.debug(`Ending group at ${timestamp}`);
        broadcastState(state);
        saveLogs(state);
        getCurrentThumbnail('stopThumbnail', () => getRecordingGroupById(groupId));
      },
      err => err.log(logger),
    );
}

async function updateRecordingGroup(req: Request, res: Response): Promise<void> {
  const fields = req.fields as UpdateGroupRequest;
  const recordingGroupId = fields['id'];
  const start = fields['start-timestamp'] || null;
  const stop = fields['stop-timestamp'] || null;
  const thumb = fields['thumbnail-timestamp'] || null;
  if (recordingGroupId == null) {
    sendUserError(res, 'No recording group ID provided');
    return;
  }
  const locator = (): (RecordingGroup | undefined) => getRecordingGroupById(recordingGroupId);
  const recording = locator();
  if (recording == null) {
    sendUserError(res, 'No recording group matches provided ID');
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
    getThumbnailForTimestamp(locator, 'startTimestamp', 'startThumbnail');
  }
  if (stop && stop != recording.stopTimestamp) {
    recording.stopTimestamp = stop;
    recording.stopThumbnail = null;
    getThumbnailForTimestamp(locator, 'stopTimestamp', 'stopThumbnail');
  }
  if (thumb) {
    recording.vodThumbnailTimestamp = thumb;
  }
  res.sendStatus(200);
  broadcastState(state);
  saveLogs(state);
}

interface FileAndTimestamp {
  file: string;
  timestamp: Timestamp;
}

function getRecordingFileAndTimestamp(): ResultAsync<FileAndTimestamp, httpUtil.HttpError> {
  const fileGetter = ResultAsync.fromPromise(
    getRecordingFile(),
    e => httpUtil.serverError('Error getting recording file', e as Error)
  ).map(({ file }) => file);

  const timestampGetter = visMixer?.getTimestamps()
    .mapErr(e => httpUtil.serverError('Error getting timestamps', e))
    .map(({ recordingTimestamp }) => recordingTimestamp)
    || errAsync<string|null, httpUtil.HttpError>(httpUtil.userError('No connection to vision mixer found'));

  return combineAsync([
    fileGetter,
    timestampGetter,
  ]).andThen(([ file, timestamp ]) => {
    if (!file || !timestamp) {
      return errAsync(httpUtil.userError(`${visMixer?.name() || 'Vision Mixer'} does not have an active file recording`));
    }
    return okAsync({ file, timestamp });
  });
}

async function getRecordingFile(): Promise<{ folder: string | null, file: string | null }> {
  if (!visMixer) {
    return { folder: null, file: null };
  }
  return combine([
    visMixer.getRecordingFolder(),
    visMixer.getRecordingFile(),
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
  locator: () => (Recording|RecordingGroup|undefined),
  timestampProp: 'startTimestamp' | 'stopTimestamp',
  thumbnailProp: 'startThumbnail' | 'stopThumbnail',
): Promise<void> {
  let recording = locator();
  if (recording == null) {
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
        recording = locator();
        if (recording == null) {
          logger.error('Recording with id no longer present');
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
  return [ matchDisp, playersDisp ].filter(str => !!str).join(': ');
}

function newRecording(streamRecordingFile: string, startTimestamp: string): Recording {
  return {
    id: getId(),
    streamRecordingFile,
    recordingFile: null,
    startTimestamp,
    stopTimestamp: null,
    startThumbnail: null,
    stopThumbnail: null,
    vodThumbnailTimestamp: null,
    displayName: 'Current Set',
    metadata: null,
  };
}

function getRecordingById(id: string): Recording | undefined {
  return state.recordings.find(r => r.id === id);
}

function newRecordingGroup(streamRecordingFile: string, startTimestamp: string): RecordingGroup {
  return {
    id: getId(),
    streamRecordingFile,
    startTimestamp,
    stopTimestamp: null,
    startThumbnail: null,
    stopThumbnail: null,
    vodThumbnailTimestamp: null,
  };
}

function getRecordingGroupById(id: string): RecordingGroup | undefined {
  return state.recordingGroups.find(r => r.id === id);
}
