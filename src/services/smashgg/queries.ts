import { SmashggSlug } from './types';
import { MAX_PAGE_SIZE } from './constants';

export interface PageInfo {
  total: number;
  totalPages: number;
  page: number;
  perPage: number;
  sortby: string;
  filter: unknown;
}

const PARTICIPANT_SUBQUERY = `
  prefix
  player {
    id
    gamerTag
    prefix
  }
  user {
    genderPronoun
    authorizations(types: [TWITTER]) {
      externalUsername
    }
  }
`;

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
      ${PARTICIPANT_SUBQUERY}
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
    genderPronoun: string | null;
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
export const PHASEGROUP_SET_QUERY = `
query PhaseQuery($phaseId: ID!, $phaseGroupIds: [ID], $page: Int, $perPage: Int) {
  phase(id: $phaseId) {
    sets(
      sortType: MAGIC,
      page: $page,
      perPage: $perPage,
      filters: {
        phaseGroupIds: $phaseGroupIds
      }
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

const TOURNAMENT_EVENTS_BASE_QUERY = `
    id
    name
    url(tab: "events")
    events {
      id
      name
      slug
    }
`;
export const TOURNAMENT_EVENTS_BY_SLUG_QUERY = `
query TournamentPhasesQuery($slug: String) {
  tournament(slug: $slug) {
    ${TOURNAMENT_EVENTS_BASE_QUERY}
  }
}
`;
export const TOURNAMENT_EVENTS_BY_ID_QUERY = `
query TournamentPhasesQuery($id: ID!) {
  tournament(id: $id) {
    ${TOURNAMENT_EVENTS_BASE_QUERY}
  }
}
`;
export interface TournamentEventsQueryResponse {
  tournament: {
    id: number;
    name: string;
    url: string;
    events: {
      id: number;
      name: string;
      slug: SmashggSlug;
    }[];
  } | null;
}


export const EVENT_PHASES_QUERY = `
query EventQuery($eventId: ID!) {
  event(id: $eventId) {
    id
    name
    slug
    phases {
      id
      name
      phaseGroups(query: {perPage: ${MAX_PAGE_SIZE}}) {
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
`;
export interface EventPhasesQueryResponse {
  event: {
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
  } | null;
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

const TOURNAMENT_TEAMS_BASE_QUERY = `
  teams(query: {
    page: $page,
    perPage: $perPage,
  }) {
    nodes {
      entrant {
        name
        participants {
          ${PARTICIPANT_SUBQUERY}
        }
      }
    }
    pageInfo {
      total
      totalPages
    }
  }
`;
export const TOURNAMENT_TEAMS_BY_SLUG_QUERY = `
query TournamentTeamsQuery($slug: String, $page: Int, $perPage: Int) {
  tournament(slug: $slug) {
    ${TOURNAMENT_TEAMS_BASE_QUERY}
  }
}
`;
export const TOURNAMENT_TEAMS_BY_ID_QUERY = `
query TournamentTeamsQuery($id: ID!, $page: Int, $perPage: Int) {
  tournament(id: $id) {
    ${TOURNAMENT_TEAMS_BASE_QUERY}
  }
}
`;
export interface TournamentTeamsQueryResponse {
  tournament: {
    teams: {
      nodes: {
        entrant: ApiEntrant;
      }[] | null;
      pageInfo: Pick<PageInfo, 'total'|'totalPages'>;
    }
  } | null;
}

const TOURNAMENT_PARTICIPANTS_BASE_QUERY = `
  participants(query: {
    page: $page,
    perPage: $perPage,
  }) {
    nodes {
      ${PARTICIPANT_SUBQUERY}
    }
    pageInfo {
      total
      totalPages
    }
  }
`;
export const TOURNAMENT_PARTICIPANTS_BY_SLUG_QUERY = `
query TournamentParticipantsQuery($slug: String, $page: Int, $perPage: Int) {
  tournament(slug: $slug) {
    ${TOURNAMENT_PARTICIPANTS_BASE_QUERY}
  }
}
`;
export const TOURNAMENT_PARTICIPANTS_BY_ID_QUERY = `
query TournamentParticipantsQuery($id: ID!, $page: Int, $perPage: Int) {
  tournament(id: $id) {
    ${TOURNAMENT_PARTICIPANTS_BASE_QUERY}
  }
}
`;
export interface TournamentParticipantsQueryResponse {
  tournament: {
    participants: {
      nodes: ApiParticipant[] | null;
      pageInfo: Pick<PageInfo, 'total'|'totalPages'>;
    }
  } | null;
}
