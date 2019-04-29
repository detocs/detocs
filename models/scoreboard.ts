import Person from './person';

export default interface Scoreboard {
  players: {
    person: Person;
    score: number;
  }[];
  match: string;
  game: string;
}
