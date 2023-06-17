import Character from '@models/character';
import Person, { nullPerson } from '@models/person';

export default interface Player {
  readonly person: Person;
  readonly score: number;
  readonly inLosers?: boolean;
  readonly comment?: string;
  readonly characters?: Character[];
}

export const nullPlayer: Required<Player> = Object.freeze({
  person: nullPerson,
  score: 0,
  inLosers: false,
  comment: '',
  characters: [],
});
