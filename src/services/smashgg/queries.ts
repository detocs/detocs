import { SmashggSlug } from './types';

interface PageInfo {
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

// Complexity: ~17 per set
export const PHASE_SET_QUERY = `
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
      perPage: 48,
      page: $page
    ) {
      nodes {${SET_SUBQUERY}}
      pageInfo {
        totalPages
      }
    }
  }
}
`;
export interface PhaseSetQueryResponse {
  phase: {
    phaseGroups: {
      nodes: {
        id: number;
        displayIdentifier: string;
      }[];
    };
    sets: {
      nodes: ApiSet[];
      pageInfo: Pick<PageInfo, 'totalPages'>;
    };
  };
}

export const SET_QUERY = `
query SetQuery($setId: ID!) {
  set(id: $setId) {${SET_SUBQUERY}
    phaseGroup {
      phase {
        id
        phaseGroups {
          nodes {
            id
            displayIdentifier
          }
        }
      }
    }
  }
}
`;
export interface SetQueryResponse {
  set: ApiSet & {
    phaseGroup: {
      phase: {
        id: number;
        phaseGroups: {
          nodes: {
            id: number;
            displayIdentifier: string;
          }[];
        };
      };
    };
  };
}

export const PHASE_EVENT_QUERY = `
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
export interface PhaseEventQueryResponse {
  phase: {
    sets: {
      nodes: {
        event: {
          id: number;
        };
      }[];
    };
  };
}

export const TOURNAMENT_PHASES_QUERY = `
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
        phaseGroups {
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

export const PHASE_GROUP_SET_QUERY = `
query PhaseGroupSets($phaseId: ID!) {
  phase(id: $phaseId) {
    phaseGroups {
      nodes {
        id
        wave {
          identifier
        }
        displayIdentifier
        sets(perPage: 64) {
          nodes {
            id
          }
        }
      }
    }
  }
}
`;
export interface PhaseGroupSetQueryResponse {
  phase: {
    phaseGroups: {
      nodes: {
        id: number;
        wave: {
          identifier: string;
        };
        displayIdentifier: string;
        sets: {
          nodes: {
            id: number;
          }[];
        };
      }[];
    };
  };
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
