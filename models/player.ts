import Person from './person';

export default interface Player {
  person: Person;
  score: number;
  inLosers?: boolean;
  comment?: string;
}
