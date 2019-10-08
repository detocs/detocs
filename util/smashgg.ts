import { GraphQLClient } from 'graphql-request';

import { getGameBySmashggId } from '../models/games';
import { getMatchBySmashggId, isGrandFinals, isTrueFinals } from '../models/matches';
import TournamentSet from "../models/tournament-set";

import { getCredentials } from './credentials';
import { nonNull } from './predicates';

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
        event {
          videogameId
        }
        slots {
          entrant {
            name
            participants {
              playerId
              player {
                gamerTag
                prefix
                twitterHandle
              }
              prefix
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
        event: {
          videogameId: number;
        };
        slots: [{
          entrant: {
            name: string;
            participants: [{
              playerId: number;
              player: {
                gamerTag: string;
                prefix: string | null;
                twitterHandle: string | null;
              };
              prefix: string | null;
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
    return sets.map(s => {
      const match = getMatchBySmashggId(s.fullRoundText);
      const videogame = getGameBySmashggId(s.event.videogameId.toString());
      return {
        id: `${s.id}`,
        match,
        videogame,
        shortIdentifier: s.identifier,
        displayName: `${s.fullRoundText} - ${s.identifier}: ${
          s.slots
            .map(slot => slot.entrant ? slot.entrant.name : '???')
            .join(' vs ')
        }`,
        entrants: s.slots.map(slot => slot.entrant)
          .filter(nonNull)
          .map((entrant, index) => ({
            name: entrant.name,
            participants: entrant.participants.map(p => ({
              smashggId: p.playerId.toString(),
              handle: p.player.gamerTag,
              prefix: p.prefix || (p.player.prefix || null),
              twitter: p.player.twitterHandle || null,
            })),
            inLosers: isTrueFinals(match) || (isGrandFinals(match) && index === 1),
          })),
      };
    });
  }

  public async eventIdForPhase(phaseId: string): Promise<string> {
    const resp: PhaseEventQueryResponse = await this.client.request(PHASE_EVENT_QUERY, { phaseId });
    return `${resp.phase.sets.nodes[0].event.id}`;
  }
}
