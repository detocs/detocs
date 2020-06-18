import { mkdir, writeFile } from 'fs';
import memoize from "micro-memoize";
import path from 'path';
import { promisify } from 'util';

import InfoState from '@server/info/state';
import BracketServiceProvider from '@services/bracket-service-provider';
import { getVersion } from '@util/meta';

import State, { Recording } from "./state";

type FilePath = string;

const asyncMkdir = promisify(mkdir);
const asyncWriteFile = promisify(writeFile);

export interface Log {
  version: string;
  file: string;
  bracketService?: string;
  eventId?: string;
  phaseId?: string;
  start: string | null;
  end: string | null;
  sets: {
    id: string | null;
    displayName: string | null;
    start: string;
    end: string | null;
    state: InfoState;
  }[];
}

export default class RecordingLogger {
  private readonly eventIdForPhase: (
    bracketServiceName: string | undefined,
    phaseId: string,
  ) => Promise<string | undefined>;
  private lastSaved: Record<FilePath, string> = {};

  public constructor(bracketProvider: BracketServiceProvider) {
    this.eventIdForPhase = memoize(
      async (
        bracketServiceName: string | undefined,
        phaseId: string,
      ): Promise<string | undefined> => {
        return bracketServiceName ?
          await bracketProvider.get(bracketServiceName).eventIdForPhase(phaseId) :
          undefined;
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
    const byPhase: Record<string, {
      gameId: string;
      recordingFile: FilePath;
      sets: Log['sets'];
    }> = {};
    for (const r of state.recordings.filter(hasMetadata).reverse()) {
      const phaseIdentifier = r.metadata.set ?
        `${r.metadata.set.serviceInfo.serviceName}_${r.metadata.set.serviceInfo.phaseId}` :
        'unknown';
      const data = byPhase[phaseIdentifier] || {
        gameId: r.metadata.game.id || 'recordings',
        recordingFile: r.streamRecordingFile,
        sets: [],
      };
      data.sets.push({
        id: r.metadata.set?.serviceInfo.id || null,
        displayName: r.displayName,
        start: r.startTimestamp,
        end: r.stopTimestamp,
        state: r.metadata,
      });
      byPhase[phaseIdentifier] = data;
    }
    const byPath: Record<FilePath, Log> = {};
    for (const [phaseIdentifier, data] of Object.entries(byPhase)) {
      const { serviceName, phaseId } = data.sets[0].state.set?.serviceInfo || {
        serviceName: undefined,
        phaseId: phaseIdentifier,
      };
      const phaseStart = data.sets[0].start;
      const phaseEnd = data.sets[data.sets.length - 1].end;
      const logFilename = `${data.gameId}-${phaseIdentifier}-${process.pid}`;
      const logSubfolder = path.basename(data.recordingFile, path.extname(data.recordingFile));
      const logFolder = path.join(state.streamRecordingFolder, logSubfolder);
      const logOutputPath = path.join(logFolder, logFilename + '.json');
      byPath[logOutputPath] = {
        version: getVersion(),
        file: data.recordingFile,
        bracketService: serviceName,
        phaseId: phaseId,
        eventId: phaseId === 'unknown' ?
          undefined :
          await this.eventIdForPhase(serviceName, phaseId),
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
