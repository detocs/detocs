import Game from '@models/game';
import Tournament from '@models/tournament';
import { Log as RecordingLog } from '@server/recording/log';

export type VodTournament = Tournament & {
  shortName: string;
  additionalTags: string[];
};

export type VodVideogame = Game & {
  hashtag: string;
  shortName: string;
  additionalTags: string[];
};

export type Log = RecordingLog & {
  title?: string;
  phaseName?: string;
  event?: Partial<{
    tournament?: Partial<VodTournament>;
    videogame?: {
      id?: string | number;
    };
  }>;
  keyframeInterval?: number;
  additionalTags?: string[];
  excludedTags?: string[];
};
