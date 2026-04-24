import Game from './game.ts';
import Match from './match.ts';
import Player from './player.ts';
import TournamentSet from './tournament-set.ts';

export default interface Scoreboard {
  players: Player[];
  match: Match;
  game: Game;
  set?: TournamentSet;
}
