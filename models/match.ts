import Person from './person';

export default interface Match {
  players: {
    [index: number]: {
      person: Person;
      score: number;
    }
  }
}