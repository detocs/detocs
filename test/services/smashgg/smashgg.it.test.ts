import SmashggClient from '@services/smashgg/smashgg';
import { loadCredentials } from '@util/configuration/credentials';

describe(SmashggClient, () => {
  beforeAll(() => {
    return loadCredentials();
  });

  describe(SmashggClient.prototype.set, () => {
    it('can fetch a single set', async () => {
      const client = new SmashggClient();
      const set = await client.set('22201526');
      expect(set.displayName).toContain('E412');
      expect(set.displayName).toContain('Datagram');
      expect(set.displayName).toContain('f6zQYGeTi2YqlrU3');
    });
  });

  describe(SmashggClient.prototype.eventIdForPhase, () => {
    it('can fetch the event ID for a phase', async () => {
      const client = new SmashggClient();
      const eventId = await client.eventIdForPhase('88428');
      expect(eventId).toBe('21726');
    });
  });
});
