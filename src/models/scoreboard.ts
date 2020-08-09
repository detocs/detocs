import Game from './game';
import Match from './match';
import Player from './player';
import TournamentSet from './tournament-set';

export default interface Scoreboard {
  players: Player[];
  match: Match;
  game: Game;
  set?: TournamentSet;
}
