import { describe, it, expect } from '@jest/globals';
import 'isomorphic-fetch';

import BattlefyClient from '@services/battlefy/battlefy.ts';

describe(BattlefyClient, () => {
  describe(BattlefyClient.prototype.phase, () => {
    // {"error":"Forbidden","message":"Direct API access is not permitted"}
    it.skip('can fetch a stage', async () => {
      const client = new BattlefyClient();
      const phase = await client.phase('5feb93030beb6e3294e047ed');
      expect(phase).toEqual({
        id: '5feb93030beb6e3294e047ed',
        eventId: '5feb93030beb6e3294e047ed',
        name: 'Big Black',
        url: 'https://battlefy.com/excelsior-gaming/battle-of-the-kings/5fa20aa59c1a774697ac1ec8' +
          '/stage/5feb93030beb6e3294e047ed/bracket/',
        startAt: 1610301600,
      });
    });
  });

  describe(BattlefyClient.prototype.eventInfo, () => {
    // {"error":"Forbidden","message":"Direct API access is not permitted"}
    it.skip('can fetch event info', async () => {
      const client = new BattlefyClient();
      const { tournament, videogame } = await client.eventInfo('5feb93030beb6e3294e047ed');
      expect(videogame.name).toBe('Under Night In-Birth Exe:Late[cl-r]');
      expect(tournament).toMatchObject({
        id: '5fa20aa59c1a774697ac1ec8',
        name: 'Battle of the Kings',
        url: 'https://battlefy.com/excelsior-gaming/battle-of-the-kings/5fa20aa59c1a774697ac1ec8' +
          '/info',
        startAt: 1610334009,
      });
    });
  });
});
