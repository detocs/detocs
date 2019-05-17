import Person from './person';

export default interface LowerThird {
  commentators: {
    person: Person;
  }[];
  match: string;
  game: string;
}
