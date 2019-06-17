import Game from './game';
import Match from './match';
import Person from './person';

export default interface LowerThird {
  commentators: {
    person: Person;
  }[];
  match: Match;
  game: Game;
}
