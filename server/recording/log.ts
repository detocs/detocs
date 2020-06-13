import { mkdir, writeFile } from 'fs';
import memoize from "micro-memoize";
import path from 'path';
import { promisify } from 'util';

import { SmashggId } from '@models/smashgg';
import InfoState from '@server/info/state';
import BracketServiceProvider from '@services/bracket-service-provider';
import { SERVICE_NAME as SMASHGG_SERVICE_NAME } from '@services/smashgg';

import State, { Recording } from "./state";

type FilePath = string;

const asyncMkdir = promisify(mkdir);
const asyncWriteFile = promisify(writeFile);

export interface Log {
  file: string;
  eventId?: SmashggId;
  phaseId?: SmashggId;
  start: string | null;
  end: string | null;
  sets: {
    id: SmashggId | null;
    displayName: string | null;
    start: string;
    end: string | null;
    state: InfoState;
  }[];
}

export default class RecordingLogger {
  private readonly eventIdForPhase: (phaseId: SmashggId) => Promise<SmashggId>;
  private lastSaved: Record<FilePath, string> = {};

  public constructor(bracketProvider: BracketServiceProvider) {
    this.eventIdForPhase = memoize(
      async (phaseId: string): Promise<string> => {
        if (+phaseId > 8_000_000) {
          // TODO: This is just an ugly hack to avoid adding Challonge support
          return '';
        }
        return await bracketProvider.get(SMASHGG_SERVICE_NAME).eventIdForPhase(phaseId);
      },
      { maxSize: 2, isPromise: true },
    );
  }

  public async saveLogs(state: State): Promise<void> {
    const logs = await this.convertToLogs(state);
    for (const [filePath, log] of Object.entries(logs)) {
      const serialized = JSON.stringify(log, null, 2);
      if (this.lastSaved[filePath] === serialized) {
        continue;
      }
      await asyncMkdir(path.dirname(filePath), { recursive: true });
      await asyncWriteFile(filePath, serialized);
      this.lastSaved[filePath] = serialized;
    }
  }

  private async convertToLogs(state: State): Promise<Record<FilePath, Log>> {
    if (!state.streamRecordingFolder) {
      return {};
    }

    // TODO: This probably isn't how we actually want this to work. Matches from
    // one phase could potentially get split into two groups if the stream
    // switches to another game in the middle, in which case we would want to
    // have two different log files rather than one so that two different
    // recording files can be cut.
    const byPhase: Record<SmashggId, {
      gameId: string;
      recordingFile: FilePath;
      sets: Log['sets'];
    }> = {};
    for (const r of state.recordings.filter(hasMetadata).reverse()) {
      const phaseId = r.metadata.set?.phaseId || 'unknown';
      const data = byPhase[phaseId] || {
        gameId: r.metadata.game.id || 'recordings',
        recordingFile: r.streamRecordingFile,
        sets: [],
      };
      data.sets.push({
        id: (r.metadata.set && r.metadata.set.id) || null,
        displayName: r.displayName,
        start: r.startTimestamp,
        end: r.stopTimestamp,
        state: r.metadata,
      });
      byPhase[phaseId] = data;
    }
    const byPath: Record<FilePath, Log> = {};
    for (const [phaseId, data] of Object.entries(byPhase)) {
      const phaseStart = data.sets[0].start;
      const phaseEnd = data.sets[data.sets.length - 1].end;
      const logFilename = `${data.gameId}-${phaseId}-${process.pid}`;
      const logSubfolder = path.basename(data.recordingFile, path.extname(data.recordingFile));
      const logFolder = path.join(state.streamRecordingFolder, logSubfolder);
      const logOutputPath = path.join(logFolder, logFilename + '.json');
      byPath[logOutputPath] = {
        file: data.recordingFile,
        phaseId: phaseId,
        eventId: phaseId === 'unknown' ? undefined :  await this.eventIdForPhase(phaseId),
        start: phaseStart,
        end: phaseEnd,
        sets: data.sets,
      };
    }
    return byPath;
  }
}

function hasMetadata(r: Recording): r is Recording & { metadata: InfoState } {
  return !!r.metadata;
}
