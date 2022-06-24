import Game from '@models/game';
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

export type Log = Omit<RecordingLog, 'sets'> & {
  title?: string;
  commentators?: string,
  sets: (RecordingLog["sets"][0] & {
    title?: string,
    commentators?: string,
  })[],
  phaseName?: string;
  event?: Partial<{
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
};
