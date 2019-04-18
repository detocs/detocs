import Person from './person';

export default interface Scoreboard {
  players: {
    [index: number]: {
      person: Person;
      score: number;
    };
  };
  match: string;
  game: string;
}
