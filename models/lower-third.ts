import Person from './person';

export default interface LowerThird {
  commentators: {
    person: Person;
  }[];
  tournament: string;
  event: string;
}
