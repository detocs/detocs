import Game from './game';
import Match from './match';
import Person from './person';
import TournamentSet from './tournament-set';

export default interface Scoreboard {
  players: {
    person: Person;
    score: number;
    inLosers?: boolean;
    comment?: string;
  }[];
  match: Match;
  game: Game;
  phaseId?: string;
  set?: TournamentSet;
  unfinishedSets?: TournamentSet[];
}
