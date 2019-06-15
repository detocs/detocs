import Game from './game';
import Person from './person';

export default interface Scoreboard {
  players: {
    person: Person;
    score: number;
  }[];
  match: string;
  game: Game;
}
