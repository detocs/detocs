import Person from './person.ts';

export default interface LowerThird {
  commentators: {
    person: Person;
  }[];
  tournament: string;
  event: string;
}
