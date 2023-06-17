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

type RecordingLogSet = RecordingLog["sets"][0];

export type LogSet = (Omit<RecordingLogSet, 'state'> & Partial<Pick<RecordingLogSet, 'state'>> & {
  title?: string;
  commentators?: string;
});

export type Log = Omit<RecordingLog, 'sets'> & {
  title?: string;
  commentators?: string,
  sets: LogSet[],
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
