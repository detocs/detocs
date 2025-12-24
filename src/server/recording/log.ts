import { promises as fs } from 'fs';
import memoize from "micro-memoize";
import path from 'path';

import { Timestamp } from '@models/timestamp';
import InfoState from '@server/info/state';
import BracketServiceProvider from '@services/bracket-service-provider';
import { getVersion } from '@util/meta';
import { nonNull } from '@util/predicates';
import { AssignedGroup, Group, groupRecordings, mostRecent } from '@util/recording';
import { fromMillis } from '@util/timestamp';

import State, { Recording } from "./state";
import GameTeam from '@models/game-team';

type FilePath = string;

// I might regret this in the long run, but for now this stops the log files
// from ballooning in size and makes them easier to work with.
type TrimmedState = Omit<InfoState, 'players' | 'commentators' | 'game' | 'set'> & {
  players: (Omit<InfoState['players'][0], 'person'> & {
    person: Omit<InfoState['players'][0]['person'], 'teams'>;
    teams?: GameTeam[];
  })[];
  commentators: (Omit<InfoState['commentators'][0], 'person'> & {
    person: Omit<InfoState['commentators'][0]['person'], 'teams'>;
  })[];
  game: Omit<InfoState['game'], 'characters' | 'characterConfigs' | 'teamConfigs'>;
  set: Omit<InfoState['set'], 'videogame'>;
};

export const CURRENT_LOG_FORMAT = "1";

export interface Log {
  format: string;
  version: string; // App version
  file: string;
  bracketService?: string;
  eventId?: string;
  phaseId?: string;
  start: string | null;
  end: string | null;
  thumbnailTimestamp?: string;
  sets: {
    id: string | null;
    displayName: string | null;
    start: string;
    end: string;
    state: TrimmedState | null;
    thumbnailTimestamp?: string;
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
      { maxSize: 20, isPromise: true },
    );
  }

  public async saveLogs(folder: string, state: State): Promise<void> {
    const logs = await this.convertToLogs(folder, state);
    for (const [filePath, log] of Object.entries(logs)) {
      const serialized = JSON.stringify(log, null, 2);
      if (this.lastSaved[filePath] === serialized) {
        continue;
      }
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, serialized);
      this.lastSaved[filePath] = serialized;
    }
  }

  private async convertToLogs(folder: string, state: State): Promise<Record<FilePath, Log>> {
    return Object.fromEntries(
      await Promise.all(
        groupRecordings(state)
          .filter(hasAtLeastOneCompletedSet)
          .map(async (group, idx) => {
            const identifier = [
              getConsistentField(group.recordings, r => r.metadata?.game.id) || 'recordings',
              getConsistentField(group.recordings, getPhaseIdentifier) || `group${idx+1}`,
              (group as AssignedGroup).id,
              process.pid,
            ].filter(nonNull).join('_');
            const logSubfolder = path.basename(
              group.streamRecordingFile,
              path.extname(group.streamRecordingFile),
            );
            const logFolder = path.join(folder, logSubfolder);
            const logOutputPath = path.join(logFolder, identifier + '.json');
            return [logOutputPath, await this.toLog(group, logFolder)];
          })
      ),
    );
  }

  private async toLog(group: Group, logFolder: string): Promise<Log> {
    const phaseId = getConsistentField(
      group.recordings,
      r => r.metadata?.set?.serviceInfo.phaseId
    );
    const serviceName = getConsistentField(
      group.recordings,
      r => r.metadata?.set?.serviceInfo.serviceName
    );
    const sets: Log['sets'] = group.recordings.filter(hasStopTimestamp).map(r => {
      let state: TrimmedState | null = null;
      if (r.metadata) {
        const gameId = r.metadata.game.id;
        const players: TrimmedState['players'] = r.metadata.players.map(
          (p): TrimmedState['players'][0] => {
            const teams = p.person.teams?.[gameId];
            const { teams: _, ...person } = p.person;
            return ({
              ...p,
              person,
              teams,
            });
          }
        );
        const commentators: TrimmedState['commentators'] = r.metadata.commentators.map(
          (p): TrimmedState['commentators'][0] => {
            const { teams: _t, ...person } = p.person;
            return ({
              person,
            });
          }
        );
        const {
          characters: _c,
          characterConfigs: _cc,
          teamConfigs: _tc,
          ...game
        } = r.metadata.game;
        const { videogame: _v, ...set } = r.metadata.set || {};
        state = {
          ...r.metadata,
          players,
          commentators,
          game,
          set,
        };
      }
      return ({
        id: r.metadata?.set?.serviceInfo.id || null,
        displayName: r.displayName,
        start: r.startTimestamp,
        end: r.stopTimestamp,
        state,
        thumbnailTimestamp: r.vodThumbnailTimestamp || undefined,
      });
    });
    const mostRecentSet = mostRecent(sets);
    if (!mostRecentSet) {
      throw new Error('There should be at least one completed set in this group');
    }
    return ({
      format: CURRENT_LOG_FORMAT,
      version: getVersion(),
      file: path.relative(logFolder, group.streamRecordingFile), // TODO: Control whether path is relative via settings?
      bracketService: serviceName,
      phaseId,
      eventId: phaseId
        ? await this.eventIdForPhase(serviceName, phaseId)
        : undefined,
      start: fromMillis(group.startMillis),
      end: group.stopMillis ? fromMillis(group.stopMillis) : mostRecentSet.end,
      thumbnailTimestamp: (group as AssignedGroup).vodThumbnailTimestamp || undefined,
      sets,
    });
  }
}

function getPhaseIdentifier(r: Recording): string|null {
  return r.metadata?.set ?
    `${r.metadata.set.serviceInfo.serviceName}-${r.metadata.set.serviceInfo.phaseId}` :
    null;
}

/**
 * Returns a field if it's the same for all refordings in the array.
 */
function getConsistentField(
  recordings: Recording[],
  fn: (r: Recording) => string|null|undefined,
): string|undefined {
  const uniqueValues = new Set(recordings.map(fn).filter(nonNull));
  if (uniqueValues.size === 1) {
    return uniqueValues.values().next().value;
  }
  return undefined;
}

function hasStopTimestamp(r: Recording): r is Recording & { stopTimestamp: Timestamp } {
  return !!r.stopTimestamp;
}

function hasAtLeastOneCompletedSet(g: Group): boolean {
  return g.recordings.some(hasStopTimestamp);
}
