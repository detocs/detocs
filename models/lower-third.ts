import Game from './game';
import Person from './person';

export default interface LowerThird {
  commentators: {
    person: Person;
  }[];
  match: string;
  game: Game;
}
