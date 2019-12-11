import Break from '../../models/break';
import { nullGame } from '../../models/game';
import LowerThird from '../../models/lower-third';
import { nullMatch } from '../../models/match';
import { nullPerson } from '../../models/person';
import Scoreboard from '../../models/scoreboard';

type State = Scoreboard & LowerThird & Break;
export default State;

export const nullState: State = Object.freeze({
  players: [
    { person: nullPerson, score: 0 },
    { person: nullPerson, score: 0 },
  ],
  match: nullMatch,
  game: nullGame,
  commentators: [
    { person: nullPerson },
    { person: nullPerson },
  ],
  tournament: '',
  event: '',
  messages: [],
});

export const sampleState: State = Object.freeze({
  players: [
    {
      person: {
        id: 0,
        handle: "Quick Dwarf",
        prefix: null,
        twitter: "QuickDwarf"
      },
      score: 0,
    },
    {
      person: {
        id: 610,
        handle: "Nymphs Blitz",
        prefix: "VEX JOG",
        twitter: "VJ_NymphsBlitz"
      },
      score: 2,
    },
  ],
  match: {
    id: 'gf',
    name: 'Grand Finals',
    smashggId: 'Grand Final',
  },
  game: {
    id: 'uni',
    name: 'Under Night In-Birth Exe:Late[st]',
    shortNames: [
      'Under Night In-Birth',
      'Under Night',
      'UNIst',
    ],
    hashtags: [
      'UNIst',
      'inbirth',
    ],
    serviceInfo: {
      twitch: { id: 'Under Night In-Birth Exe:Late[st]' },
      smashgg: { id: '451' },
    },
  },
  commentators: [
    {
      person: {
        id: 0,
        handle: "Quick Dwarf",
        prefix: null,
        twitter: "QuickDwarf"
      },
    },
    {
      person: {
        id: 610,
        handle: "Nymphs Blitz",
        prefix: "VEX JOG",
        twitter: "VJ_NymphsBlitz"
      },
    },
  ],
  tournament: 'Sample Tournament 2',
  event: 'Under Night In-Birth top 8',
  messages: [ 'Message 1', 'Sample Placeholder Message 2' ],
});
