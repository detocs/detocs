import { GraphQLClient } from 'graphql-request';

import { ApiToken } from "../models/smashgg";
import TournamentSet from "../models/tournament-set";
import { getCredentials } from './credentials';

const ENDPOINT = 'https://api.smash.gg/gql/alpha';

const PHASE_SET_QUERY = `
query PhaseQuery($phaseId: ID!) {
  phase(id: $phaseId) {
    sets(
      perPage: 128,
      sortType: MAGIC
    ) {
      nodes {
        id
        identifier
        round
        fullRoundText
        state
        completedAt
        slots {
          entrant {
            name
            participants {
              playerId
            }
          }
        }
      }
    }
  }
}
`;
interface PhaseSetQueryResponse {
  phase: {
    sets: {
      nodes: [{
        id: number;
        identifier: string;
        round: number;
        fullRoundText: string;
        state: number;
        completedAt: number | null;
        slots: [{
          entrant: {
            name: string;
            participants: [{
              playerId: number;
            }];
          } | null;
        }];
      }];
    };
  };
};

const PHASE_EVENT_QUERY = `
query PhaseEventQuery($phaseId: ID!) {
  phase(id: $phaseId) {
    sets(perPage: 1) {
      nodes {
        event {
          id
        }
      }
    }
  }
}
`;
interface PhaseEventQueryResponse {
  phase: {
    sets: {
      nodes: [{
        event: {
          id: number;
        };
      }];
    };
  };
};

export default class SmashggClient {
  private client: GraphQLClient;

  public constructor() {
    const token = getCredentials().smashggApiToken;
    if (!token) {
      throw new Error('No smash.gg API token');
    }
    this.client = new GraphQLClient(ENDPOINT, {
      headers: { authorization: `Bearer ${token}` },
    });
  }

  public async upcomingSetsByPhase(phaseId: string): Promise<TournamentSet[]> {
    const resp: PhaseSetQueryResponse = await this.client.request(PHASE_SET_QUERY, { phaseId });
    let sets = resp.phase.sets.nodes;
    return sets.map(s => ({
      id: `${s.id}`,
      shortIdentifier: s.identifier,
      displayName: `${s.fullRoundText} - ${s.identifier}: ${
        s.slots
          .map(slot => slot.entrant ? slot.entrant.name : '???')
          .join(' vs ')
      }`,
    }));
  }

  public async eventIdForPhase(phaseId: string): Promise<string> {
    const resp: PhaseEventQueryResponse = await this.client.request(PHASE_EVENT_QUERY, { phaseId });
    return `${resp.phase.sets.nodes[0].event.id}`;
  }
}
