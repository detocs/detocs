import Person, { nullPerson } from './person';

export default interface Player {
  readonly person: Person;
  readonly score: number;
  readonly inLosers?: boolean;
  readonly comment?: string;
}

export const nullPlayer = Object.freeze({
  person: nullPerson,
  score: 0,
  inLosers: false,
});
