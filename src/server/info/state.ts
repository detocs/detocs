import Break from '@models/break';
import { nullGame } from '@models/game';
import LowerThird from '@models/lower-third';
import { nullMatch } from '@models/match';
import { nullPerson } from '@models/person';
import Scoreboard from '@models/scoreboard';

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
        id: 'd202007190602063570000',
        handle: "Quick Dwarf",
        prefix: null,
        serviceIds: {
          twitter: "QuickDwarf",
        },
      },
      score: 0,
    },
    {
      person: {
        id: 'd202008190602063570000',
        handle: "Nymphs Blitz",
        prefix: "VEX JOG",
        alias: "VJ",
        pronouns: "he/him",
        serviceIds: {
          twitter: "VJ_NymphsBlitz",
        },
      },
      score: 2,
      characters: [{ name: "Ryu" }],
      comment: 'red',
      inLosers: true,
      teams: [
        { characters: [{ id: "hyde" }] },
        { characters: [{ id: "waldstein" }] },
      ],
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
        id: 'd202007190602063570000',
        handle: "Quick Dwarf",
        prefix: null,
        serviceIds: {
          twitter: "QuickDwarf",
        },
      },
    },
    {
      person: {
        id: 'd202008190602063570000',
        handle: "Nymphs Blitz",
        prefix: "VEX JOG",
        alias: "VJ",
        pronouns: "he/him",
        serviceIds: {
          twitter: "VJ_NymphsBlitz",
        },
      },
    },
  ],
  tournament: 'Sample Tournament 2',
  event: 'Under Night In-Birth top 8',
  messages: [ 'Message 1', 'Sample Placeholder Message 2' ],
});
