import { nullGame } from '../../models/game';
import LowerThird from '../../models/lower-third';
import { nullMatch } from '../../models/match';
import { nullPerson } from '../../models/person';
import Scoreboard from '../../models/scoreboard';

type State = Scoreboard & LowerThird;
export default State;

export const nullState: State = Object.freeze({
  players: [
    { person: nullPerson, score: 0 },
    { person: nullPerson, score: 0 },
  ],
  match: nullMatch,
  game: nullGame,
  commentators: [
    { person: nullPerson },
    { person: nullPerson },
  ],
  tournament: '',
  event: '',
});
