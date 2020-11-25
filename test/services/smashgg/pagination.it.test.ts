import { paginatedQuery } from '@services/smashgg/pagination';
import {
  PHASE_SET_QUERY,
  PhaseSetQueryResponse,
} from '@services/smashgg/queries';
import SmashggClient from '@services/smashgg/smashgg';
import { loadCredentials } from '@util/configuration/credentials';

describe(paginatedQuery, () => {
  beforeAll(() => {
    return loadCredentials();
  });

  it('handles single page queries', async () => {
    const client = new SmashggClient().getClient();
    const request = spyOn(client, 'request').and.callThrough();
    const rawRequest = spyOn(client, 'rawRequest').and.callThrough();
    const data = await paginatedQuery({
      client,
      query: PHASE_SET_QUERY,
      params: { phaseId: '857511' }, // Lunar Phase Online Edition #13 Under Night In-Birth
      extractor: (resp: PhaseSetQueryResponse) => resp.phase.sets,
    });
    expect(request.calls.count() + rawRequest.calls.count()).toBe(1);
    expect(data).toHaveLength(6);
  });

  it('uses auto page size by default', async () => {
    const client = new SmashggClient().getClient();
    const request = spyOn(client, 'request').and.callThrough();
    const rawRequest = spyOn(client, 'rawRequest').and.callThrough();
    const data = await paginatedQuery({
      client,
      query: PHASE_SET_QUERY,
      params: { phaseId: '601226' }, // Moonlit Madness 2019 Blazblue Cross Tag Battle
      extractor: (resp: PhaseSetQueryResponse) => resp.phase.sets,
    });
    // Default perPage should be 14, giving 2 pages total
    expect(request.calls.count() + rawRequest.calls.count()).toBe(2);
    expect(data).toHaveLength(24);
  });

  it('chooses optimal page sizes when possible', async () => {
    const client = new SmashggClient().getClient();
    const request = spyOn(client, 'request').and.callThrough();
    const rawRequest = spyOn(client, 'rawRequest').and.callThrough();
    const data = await paginatedQuery({
      client,
      query: PHASE_SET_QUERY,
      params: { phaseId: '879120' }, // North America Brawlhalla World Championship 2020 2v2 top 64
      extractor: (resp: PhaseSetQueryResponse) => resp.phase.sets,
    });
    // Default perPage should be 14, giving 4 pages total
    expect(request.calls.count() + rawRequest.calls.count()).toBeLessThanOrEqual(3);
    expect(data).toHaveLength(48);
  });

  it('uses provided default page size', async () => {
    const client = new SmashggClient().getClient();
    const request = spyOn(client, 'request').and.callThrough();
    const rawRequest = spyOn(client, 'rawRequest').and.callThrough();
    const data = await paginatedQuery({
      client,
      query: PHASE_SET_QUERY,
      params: { phaseId: '601226' }, // Moonlit Madness 2019 Blazblue Cross Tag Battle
      extractor: (resp: PhaseSetQueryResponse) => resp.phase.sets,
      defaultPageSize: 24,
    });
    expect(request.calls.count() + rawRequest.calls.count()).toBe(1);
    expect(data).toHaveLength(24);
  });
});
