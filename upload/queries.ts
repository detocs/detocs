export const TOURNAMENT_PHASE_QUERY = `
query PhasesQuery($slug: String) {
  tournament(slug: $slug){
    events {
      id
      name
      phases {
        name
        id
      }
    }
  }
}
`;

export const SET_QUERY = `
query SetQuery($setId: ID!) {
  set(id: $setId) {
    id
    fullRoundText
    completedAt
    slots {
      entrant {
        name
        participants {
          prefix
          player {
            gamerTag
            prefix
          }
        }
      }
    }
  }
}
`;
export interface SetQueryResponse {
  set: {
    id: number;
    fullRoundText: string;
    completedAt: number;
    slots: {
      entrant: {
        name: string;
        participants: {
          prefix: string | null;
          player: {
            gamerTag: string;
            prefix: string | null;
          };
        }[];
      };
    }[];
  };
}

export const PHASE_SET_QUERY = `
query PhaseQuery($phaseId: ID!, $page: Int) {
  phase(id: $phaseId) {
    sets(
      perPage: 64
      page: $page
    ) {
      nodes {
        id
        fullRoundText
        displayScore
        completedAt
        slots {
          entrant {
            name
            participants {
              prefix
              player {
                gamerTag
                prefix
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
export interface PhaseSetQueryResponse {
  phase: {
    sets: {
      nodes: {
        id: number;
        fullRoundText: string;
        completedAt: number;
        slots: {
          entrant: {
            name: string;
            participants: {
              prefix: string | null;
              player: {
                gamerTag: string;
                prefix: string | null;
              };
            }[];
          };
        }[];
      }[];
      pageInfo: {
        totalPages: number;
      };
    };
  };
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
    name
    waves {
      startAt
    }
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
export interface PhaseQueryResponse {
  phase: {
    name: string;
    waves: {
      startAt: number;
    }[];
    sets: {
      nodes: {
        event: {
          id: number;
        };
      }[];
    };
  };
}

export const EVENT_QUERY = `
query EventQuery($eventId: ID!) {
  event(id: $eventId) {
    id
    videogame {
      id
      name
      displayName
    }
    tournament {
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
  };
}
