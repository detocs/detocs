import { SmashggSlug } from './types';

export interface PageInfo {
  total: number;
  totalPages: number;
  page: number;
  perPage: number;
  sortby: string;
  filter: unknown;
}

const SET_SUBQUERY = `
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
    name
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
`;
export interface ApiSet {
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
      name: string;
    };
  };
  slots: {
    entrant: ApiEntrant | null;
  }[];
}

export interface ApiEntrant {
  name: string;
  participants: ApiParticipant[];
}

export interface ApiParticipant {
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
}

export const PHASE_PHASEGROUP_QUERY = `
query PhaseQuery($phaseId: ID!, $page: Int, $perPage: Int) {
  phase(id: $phaseId) {
    phaseGroups(query: {
      page: $page,
      perPage: $perPage,
    }) {
      nodes {
        id
        displayIdentifier
      }
      pageInfo {
        total
        totalPages
      }
    }
  }
}
`;
export interface PhasePhaseGroupQueryResponse {
  phase: {
    phaseGroups: {
      nodes: {
        id: number;
        displayIdentifier: string;
      }[];
      pageInfo: Pick<PageInfo, 'total'|'totalPages'>;
    };
  };
}

export const PHASE_SET_QUERY = `
query PhaseQuery($phaseId: ID!, $page: Int, $perPage: Int) {
  phase(id: $phaseId) {
    sets(
      sortType: MAGIC,
      page: $page,
      perPage: $perPage,
    ) {
      nodes {${SET_SUBQUERY}}
      pageInfo {
        total
        totalPages
      }
    }
  }
}
`;
export interface PhaseSetQueryResponse {
  phase: {
    sets: {
      nodes: ApiSet[];
      pageInfo: Pick<PageInfo, 'total'|'totalPages'>;
    };
  };
}

export const SET_QUERY = `
query SetQuery($setId: ID!) {
  set(id: $setId) {${SET_SUBQUERY}
    phaseGroup {
      displayIdentifier
      phase {
        id
        groupCount
      }
    }
  }
}
`;
export interface SetQueryResponse {
  set: ApiSet & {
    phaseGroup: {
      displayIdentifier: string;
      phase: {
        id: number;
        groupCount: number;
      };
    };
  };
}

export const PHASE_EVENT_QUERY = `
query PhaseEventQuery($phaseId: ID!) {
  phase(id: $phaseId) {
    event {
      id
    }
  }
}
`;
export interface PhaseEventQueryResponse {
  phase: {
    event: {
      id: number;
    };
  };
}

const TOURNAMENT_PHASES_BASE_QUERY = `
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
        phaseGroups(query: {perPage: 1024}) {
          nodes {
            id
            displayIdentifier
            wave {
              id
            }
          }
        }
      }
    }
`;
export const TOURNAMENT_PHASES_BY_SLUG_QUERY = `
query TournamentPhasesQuery($slug: String) {
  tournament(slug: $slug) {
    ${TOURNAMENT_PHASES_BASE_QUERY}
  }
}
`;
export const TOURNAMENT_PHASES_BY_ID_QUERY = `
query TournamentPhasesQuery($id: ID!) {
  tournament(id: $id) {
    ${TOURNAMENT_PHASES_BASE_QUERY}
  }
}
`;
export interface TournamentPhasesQueryResponse {
  tournament: TournamentPhases | null;
}
export interface TournamentPhases {
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
      phaseGroups: {
        nodes: {
          id: number;
          displayIdentifier: string;
        }[];
      };
    }[];
  }[];
}

export const EVENT_QUERY = `
query EventQuery($eventId: ID!) {
  event(id: $eventId) {
    id
    videogame {
      id
      name
    }
    tournament {
      id
      name
      venueName
      venueAddress
      city
      hashtag
      url(relative: false)
      startAt
      endAt
      timezone
    }
  }
}
`;
export interface EventQueryResponse {
  event: {
    id: number;
    videogame: {
      id: number;
      name: string;
    };
    tournament: {
      id: number;
      name: string;
      venueName: string | null;
      venueAddress: string | null;
      city: string | null;
      hashtag: string | null;
      url: string;
      startAt: number;
      endAt: number | null;
      timezone: string | null;
    };
  } | null;
}

export const PHASE_QUERY = `
query PhaseQuery($phaseId: ID!) {
  phase(id: $phaseId) {
    id
    name
    event {
      id
      slug
    }
    waves {
      startAt
    }
  }
}
`;
export interface PhaseQueryResponse {
  phase: {
    id: number;
    name: string;
    event: {
      id: number;
      slug: string;
    };
    waves: {
      startAt: number;
    }[] | null;
  };
}
