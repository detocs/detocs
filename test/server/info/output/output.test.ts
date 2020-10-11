import { nullGame } from '@models/game';
import { nullMatch } from '@models/match';
import { toOutputState } from '@server/info/output/output';

describe(toOutputState, () => {
  it('copies twitter handles', () => {
    const input = {
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
            serviceIds: {
              twitter: "VJ_NymphsBlitz",
            },
          },
          score: 2,
        },
      ],
      match: nullMatch,
      game: nullGame,
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
            serviceIds: {
              twitter: "VJ_NymphsBlitz",
            },
          },
        },
      ],
      tournament: '',
      event: '',
      messages: [],
    };

    const output = {
      players: [
        {
          person: {
            id: 'd202007190602063570000',
            handle: "Quick Dwarf",
            prefix: null,
            twitter: "QuickDwarf",
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
            twitter: "VJ_NymphsBlitz",
            serviceIds: {
              twitter: "VJ_NymphsBlitz",
            },
          },
          score: 2,
        },
      ],
      match: nullMatch,
      game: nullGame,
      commentators: [
        {
          person: {
            id: 'd202007190602063570000',
            handle: "Quick Dwarf",
            prefix: null,
            twitter: "QuickDwarf",
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
            twitter: "VJ_NymphsBlitz",
            serviceIds: {
              twitter: "VJ_NymphsBlitz",
            },
          },
        },
      ],
      tournament: '',
      event: '',
      messages: [],
    };

    expect(toOutputState(input)).toEqual(output);
  });
});
