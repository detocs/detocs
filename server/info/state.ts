import { nullGame } from '../../models/game';
import LowerThird from '../../models/lower-third';
import { nullMatch } from '../../models/match';
import Scoreboard from '../../models/scoreboard';

type State = Scoreboard & LowerThird;
export default State;

export const nullState = {
  players: [],
  match: nullMatch,
  game: nullGame,
  commentators: [],
  tournament: '',
  event: '',
};
