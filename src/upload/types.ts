import Character from '@models/character';
import Game from '@models/game';
import { Timestamp } from '@models/timestamp';
import Tournament from '@models/tournament';
import TournamentPhase from '@models/tournament-phase';
import { Log as RecordingLog } from '@server/recording/log';

export type VodTournament = Partial<Tournament> &
Pick<Tournament, 'name'> & {
  shortName: string;
  additionalTags: string[];
};

export type VodVideogame = Game & {
  hashtag: string;
  shortName: string;
};

export type VodPhase = Pick<TournamentPhase, 'name' | 'startAt'>;

export type VodUserData = Record<string, unknown>;

type RecordingLogSet = RecordingLog["sets"][0];

export type LogSet = (Omit<RecordingLogSet, 'state'> & Partial<Pick<RecordingLogSet, 'state'>> & {
  title?: string;
  commentary?: string,
  commentators?: string, // backwards-compatibility
  userData?: VodUserData;
  uploadId?: string;
});

export type Log = Omit<RecordingLog, 'sets'> & {
  title?: string;
  commentary?: string,
  commentators?: string, // backwards-compatibility
  sets: LogSet[],
  phaseName?: string;
  event?: Partial<{
    name?: string;
    tournament?: Partial<VodTournament>;
    videogame?: {
      id?: string | number;
    };
  }>;
  keyframeInterval?: number;
  matchDescription?: string;
  additionalTags?: string[];
  excludedTags?: string[];
  userData?: VodUserData;
  uploadId?: string;
};

export interface Set {
  id: string | null;
  phaseGroupId: string | null;
  players: {
    name: string;
    prefix: string | null;
    handle: string;
    alias: string | null;
    characters?: Character[];
  }[];
  fullRoundText: string | null;
  start: Timestamp | null;
  end: Timestamp | null;
  userData?: VodUserData;
  uploadId?: string;
}
