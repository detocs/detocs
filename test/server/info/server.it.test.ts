import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { promises as fs } from 'fs';
import { Server } from 'http';

import PersonDatabase from '@models/people.ts';
import Person from '@models/person.ts';
import start from '@server/info/server.ts';
import startBracketServer from '@server/bracket/server.ts';
import State, { nullState } from '@server/info/state.ts';
import { BRACKETS_PORT } from '@server/ports.ts';
import BracketServiceProvider from '@services/bracket-service-provider.ts';
import { objectFormData } from '@util/forms.ts';
import Game from '@models/game.ts';

const TEST_PORT = 40000;
const TEST_DB_FILE = 'info-server-test-people.json';
const EMPTY_FORM = Object.freeze({
  'players[0][id]': '',
  'players[0][prefix]': '',
  'players[0][handle]': '',
  'players[0][alias]': '',
  'players[0][pronouns]': '',
  'players[0][location][country]': '',
  'players[0][location][state]': '',
  'players[0][location][city]': '',
  'players[0][serviceIds][twitter]': '',
  'players[0][inLosers]': '',
  'players[0][comment]': '',
  'players[0][score]': 0,
  'players[1][id]': '',
  'players[1][prefix]': '',
  'players[1][handle]': '',
  'players[1][alias]': '',
  'players[1][pronouns]': '',
  'players[1][location][country]': '',
  'players[1][location][state]': '',
  'players[1][location][city]': '',
  'players[1][serviceIds][twitter]': '',
  'players[1][inLosers]': '',
  'players[1][comment]': '',
  'players[1][score]': 0,
  'match[id]': '',
  'match[name]': '',
  'game[id]': '',
  'game[name]': '',
  'set[serviceName]': '',
  'set[id]': '',
  'set[phaseId]': '',
  'set[phaseGroupId]': '',
});
const GAMES: Record<string, Game> = {
  'game1': {
    id: 'game1',
    name: 'Game 1',
    shortNames: [],
    hashtags: [],
    serviceInfo: {},
    characters: [
      { id: 'char1', name: 'Character 1' },
      { id: 'char2', name: 'Character 2' },
    ],
    teamSize: 2,
    characterConfigs: [
      {
        id: 'charConfig1',
        name: 'Character Config 1',
        options: [
          { id: 'charOption1', name: 'Character Option 1' },
          { id: 'charOption2', name: 'Character Option 2' },
        ],
      }
    ],
    teamConfigs: [
      {
        id: 'teamConfig1',
        name: 'Team Config 1',
        options: [
          { id: 'teamOption1', name: 'Team Option 1' },
          { id: 'teamOption2', name: 'Team Option 2' },
        ],
      }
    ]
  },
};

let infoServer: Server;
let bracketServer: Server;

function getInfo(): Promise<State> {
  return fetch(`http://localhost:${TEST_PORT}/state`)
    .then(resp => resp.json());
}

async function submitScoreboard(form: Record<string, unknown>): Promise<void> {
  await fetch(`http://localhost:${TEST_PORT}/scoreboard`, {
    method: 'POST',
    body: objectFormData(Object.assign({}, EMPTY_FORM, form)),
  });
}

async function clearScoreboard(): Promise<void> {
  await submitScoreboard({});
}

beforeAll(async () => {
  bracketServer = await startBracketServer({
    port: BRACKETS_PORT,
    bracketProvider: new BracketServiceProvider(),
  });
  infoServer = await start({
    port: TEST_PORT,
    // TODO: Use in-memory database
    personDatabase: new PersonDatabase(TEST_DB_FILE),
    gameDatabase: {
      getGames: () => Object.values(GAMES),
      getGameById: id => GAMES[id] || null,
      getGameByServiceId: () => null,
    },
    outputConfigs: [],
    defaultState: {},
  });
});

afterAll(async () => {
  bracketServer.close();
  infoServer.close();
  await fs.unlink(TEST_DB_FILE).catch(() => { /* ignore */ });
});

describe('info server', () => {
  beforeEach(clearScoreboard);

  it('defaults to empty state', async () => {
    const state = await getInfo();
    expect(state).toEqual(nullState);
  });

  it('parses char 1 correctly', async () => {
    await submitScoreboard({
      'players[0][teams][0][characters][0][id]': 'char1',
      'game[id]': 'game1',
      'game[name]': 'Game 1',
    });
    const state = await getInfo();
    const expected: Person['teams'] = {
      'game1': [
        {
          characters: [
            { id: 'char1' },
          ],
        },
      ],
    };
    expect(state.players[0].person.teams).toEqual(expected);
  });

  it('parses char 2 correctly', async () => {
    await submitScoreboard({
      'players[0][teams][0][characters][1][id]': 'char1',
      'game[id]': 'game1',
      'game[name]': 'Game 1',
    });
    const state = await getInfo();
    const expected: Person['teams'] = {
      'game1': [
        {
          characters: [
            { id: '' },
            { id: 'char1' },
          ],
        },
      ],
    };
    expect(state.players[0].person.teams).toEqual(expected);
  });

  it('parses team configs correctly', async () => {
    await submitScoreboard({
      'players[0][teams][0][options][teamConfig1]': 'teamOption2',
      'game[id]': 'game1',
      'game[name]': 'Game 1',
    });
    const state = await getInfo();
    const expected: Person['teams'] = {
      'game1': [
        {
          characters: [],
          options: {
            'teamConfig1': 'teamOption2',
          }
        },
      ],
    };
    expect(state.players[0].person.teams).toEqual(expected);
  });

  it('parses char configs correctly', async () => {
    await submitScoreboard({
      'players[0][teams][0][characters][0][options][charConfig1]': 'charOption1',
      'game[id]': 'game1',
      'game[name]': 'Game 1',
    });
    const state = await getInfo();
    const expected: Person['teams'] = {
      'game1': [
        {
          characters: [
            { id: '', options: { 'charConfig1': 'charOption1' } },
          ],
        },
      ],
    };
    expect(state.players[0].person.teams).toEqual(expected);
  });

  it('parses team 2 correctly', async () => {
    await submitScoreboard({
      'players[0][teams][1][characters][0][id]': 'char1',
      'game[id]': 'game1',
      'game[name]': 'Game 1',
    });
    const state = await getInfo();
    const expected: Person['teams'] = {
      'game1': [
        {
          characters: [],
        },
        {
          characters: [
            { id: 'char1' },
          ],
        },
      ],
    };
    expect(state.players[0].person.teams).toEqual(expected);
  });
});
