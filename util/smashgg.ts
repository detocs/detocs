import { GraphQLClient } from 'graphql-request';

import { getGameBySmashggId } from '../models/games';
import { getMatchBySmashggId, isGrandFinals, isTrueFinals } from '../models/matches';
import TournamentSet from "../models/tournament-set";

import { getCredentials } from './credentials';
import { nonNull } from './predicates';
import { SmashggSlug, TOURNAMENT_URL_REGEX, SMASHGG_BASE_URL } from '../models/smashgg';
import Tournament from '../models/tournament';
import TournamentEvent from '../models/tournament-event';
import TournamentPhase from '../models/tournament-phase';

const ENDPOINT = 'https://api.smash.gg/gql/alpha';

interface PageInfo {
  total: number;
  totalPages: number;
  page: number;
  perPage: number;
  sortby: string;
  filter: unknown;
}

const PHASE_SET_QUERY = `
query PhaseQuery($phaseId: ID!, $page: Int) {
  phase(id: $phaseId) {
    phaseGroups(query: { perPage: 64 }) {
      nodes {
        id
        displayIdentifier
      }
    }
    sets(
      sortType: MAGIC,
      perPage: 64,
      page: $page
    ) {
      nodes {
        id
        identifier
        round
        fullRoundText
        state
        completedAt
        phaseGroup {
          id
        }
        event {
          videogame {
            id
          }
        }
        slots {
          entrant {
            name
            participants {
              prefix
              player {
                id
                gamerTag
                prefix
              }
              user {
                authorizations(types: [TWITTER]) {
                  externalUsername
                }
              }
            }
          }
        }
      }
      pageInfo {
        totalPages
      }
    }
  }
}
`;
interface PhaseSetQueryResponse {
  phase: {
    phaseGroups: {
      nodes: {
        id: number;
        displayIdentifier: string;
      }[];
    };
    sets: {
      nodes: {
        id: number;
        identifier: string;
        phaseGroup: {
          id: number;
        };
        round: number;
        fullRoundText: string;
        state: number;
        completedAt: number | null;
        event: {
          videogame: {
            id: number;
          };
        };
        slots: {
          entrant: {
            name: string;
            participants: {
              prefix: string | null;
              player: {
                id: number;
                gamerTag: string;
                prefix: string | null;
              };
              user: {
                authorizations: {
                  externalUsername: string;
                }[] | null;
              } | null;
            }[];
          } | null;
        }[];
      }[];
      pageInfo: Pick<PageInfo, 'totalPages'>;
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
      nodes: {
        event: {
          id: number;
        };
      }[];
    };
  };
};

const TOURNAMENT_PHASES_QUERY = `
query TournamentPhasesQuery($slug: String) {
  tournament(slug: $slug) {
    id
    name
    url(tab: "events")
    events {
      id
      name
      slug
      phases {
        id
        name
      }
    }
  }
}
`;
interface TournamentPhasesQueryResponse {
  tournament: {
    id: number;
    name: string;
    url: string;
    events: {
      id: number;
      name: string;
      slug: SmashggSlug;
      phases: {
        id: number;
        name: string;
      }[];
    }[];
  } | null;
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

  public getClient(): GraphQLClient {
    return this.client;
  }

  public async upcomingSetsByPhase(phaseId: string): Promise<TournamentSet[]> {
    let sets: PhaseSetQueryResponse['phase']['sets']['nodes'] = [];
    let pg: PhaseSetQueryResponse['phase']['phaseGroups']['nodes'] = [];
    let page = 0;
    let totalPages = 0;
    while (page <= totalPages) {
      const resp: PhaseSetQueryResponse = await this.client.request(
        PHASE_SET_QUERY,
        { phaseId, page: page++ },
      );
      sets = sets.concat(resp.phase.sets.nodes);
      pg = resp.phase.phaseGroups.nodes;
      totalPages = resp.phase.sets.pageInfo.totalPages;
    }
    const phaseGroups = new Map(pg.map(
      ({ id, displayIdentifier }) => [ id, displayIdentifier ]
    ));
    const multiGroup = phaseGroups.size > 1;
    return sets.map(s => {
      const phaseGroupPrefix = multiGroup ? `${phaseGroups.get(s.phaseGroup.id)} ` : '';
      const origMatch = getMatchBySmashggId(s.fullRoundText);
      let match = origMatch;
      if (match && multiGroup) {
        match = {
          ...match,
          name: phaseGroupPrefix + match?.name,
        };
      }
      const videogame = getGameBySmashggId(s.event.videogame.id.toString());
      const matchName = origMatch ? origMatch.name : s.fullRoundText;
      return {
        id: `${s.id}`,
        phaseId,
        match,
        videogame,
        shortIdentifier: s.identifier,
        displayName: `${phaseGroupPrefix}${s.identifier} - ${matchName}: ${
          s.slots
            .map(slot => slot.entrant ? slot.entrant.name : '???')
            .join(' vs ')
        }`,
        entrants: s.slots.map(slot => slot.entrant)
          .filter(nonNull)
          .map((entrant, index) => ({
            name: entrant.name,
            participants: entrant.participants.map(p => ({
              smashggId: p.player.id.toString(),
              handle: p.player.gamerTag,
              prefix: p.prefix || (p.player.prefix || null),
              twitter: p.user?.authorizations?.[0].externalUsername || null,
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

  public async phasesForTournament(
    slug: SmashggSlug,
  ): Promise<{ tournament: Tournament; events: TournamentEvent[]; phases: TournamentPhase[] }> {
    const resp: TournamentPhasesQueryResponse = await this.client.request(
      TOURNAMENT_PHASES_QUERY,
      { slug },
    );
    if (!resp.tournament) {
      throw new Error(`tournament "${slug}" not found`);
    }
    const t = resp.tournament;
    return {
      tournament: {
        id: t.id.toString(),
        name: t.name,
        url: fullSmashggUrl(t.url),
      },
      events: t.events.map(e => ({
        id: e.id.toString(),
        name: e.name,
        url: fullSmashggUrl(e.slug),
      })),
      phases: t.events.reduce<TournamentPhase[]>(
        (acc, e) => acc.concat(
          e.phases.map(p => ({
            id: p.id.toString(),
            name: p.name,
            eventId: e.id.toString(),
            url: fullSmashggUrl(e.slug.replace('event', 'events') + `/brackets/${p.id}`),
          }))
        ),
        [],
      ),
    };
  }
}

export function parseTournamentSlug(url: string): SmashggSlug | null {
  const match = TOURNAMENT_URL_REGEX.exec(url);
  if (!match) {
    return null;
  }
  return match[1];
}

function fullSmashggUrl(relative: string): string {
  if (relative[0] === '/') {
    return SMASHGG_BASE_URL + relative;
  } else {
    return SMASHGG_BASE_URL + '/' + relative;
  }
}
