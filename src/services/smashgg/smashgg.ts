import { GraphQLClient } from 'graphql-request';

import { getGameBySmashggId, getGameByServiceId } from '@models/games';
import { getMatchBySmashggId, isGrandFinals, isTrueFinals } from '@models/matches';
import Tournament from '@models/tournament';
import TournamentEvent from '@models/tournament-event';
import TournamentPhase from '@models/tournament-phase';
import TournamentPhaseGroup from '@models/tournament-phase-group';
import TournamentSet from '@models/tournament-set';
import BracketService from '@services/bracket-service';
import { getCredentials } from '@util/configuration/credentials';
import { nonNull } from '@util/predicates';

import {
  TOURNAMENT_URL_REGEX,
  SMASHGG_BASE_URL,
  ENDPOINT,
  SMASHGG_SERVICE_NAME,
} from "./constants";
import {
  ApiSet,
  PHASE_SET_QUERY,
  PhaseSetQueryResponse,
  PHASE_EVENT_QUERY,
  PhaseEventQueryResponse,
  TOURNAMENT_PHASES_QUERY,
  TournamentPhasesQueryResponse,
  PHASE_GROUP_SET_QUERY,
  PhaseGroupSetQueryResponse,
  SET_QUERY,
  SetQueryResponse,
  EVENT_QUERY,
  EventQueryResponse,
  PHASE_QUERY,
  PhaseQueryResponse,
} from './queries';
import { SmashggSlug } from './types';
import Game, { nullGame } from '@models/game';

export default class SmashggClient implements BracketService {
  private client: GraphQLClient;

  public constructor() {
    const token = getCredentials().smashggKey;
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

  public name(): string {
    return SMASHGG_SERVICE_NAME;
  }

  public async upcomingSetsByPhase(phaseId: string): Promise<TournamentSet[]> {
    let sets: PhaseSetQueryResponse['phase']['sets']['nodes'] = [];
    let pg: PhaseSetQueryResponse['phase']['phaseGroups']['nodes'] = [];
    let page = 1;
    let totalPages = 1;
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
    return sets.map(s => this.convertSet(phaseId, phaseGroups, s));
  }

  public async set(setId: string): Promise<TournamentSet> {
    const resp: SetQueryResponse = await this.client.request(SET_QUERY, { setId });
    const phaseGroups = new Map(resp.set.phaseGroup.phase.phaseGroups.nodes.map(
      ({ id, displayIdentifier }) => [ id, displayIdentifier ]
    ));
    return this.convertSet(
      resp.set.phaseGroup.phase.id.toString(),
      phaseGroups,
      resp.set,
    );
  }

  private convertSet(
    phaseId: string,
    phaseGroupsToName: Map<number, string>,
    s: ApiSet,
  ): TournamentSet {
    const multiGroup = phaseGroupsToName.size > 1;
    const phaseGroupPrefix = multiGroup ? `${phaseGroupsToName.get(s.phaseGroup.id)} ` : '';
    const origMatch = getMatchBySmashggId(s.fullRoundText);
    let match = origMatch;
    if (match && multiGroup) {
      match = {
        ...match,
        id: '',
        name: phaseGroupPrefix + match?.name,
      };
    }
    const videogame = getGameBySmashggId(s.event.videogame.id.toString());
    const matchName = origMatch ? origMatch.id : s.fullRoundText;
    return {
      serviceInfo: {
        serviceName: this.name(),
        id: s.id.toString(),
        phaseId,
      },
      match,
      videogame,
      shortIdentifier: s.identifier,
      displayName: `${phaseGroupPrefix}${s.identifier} - ${matchName}: ${
        s.slots
          .map(slot => slot.entrant ? slot.entrant.name : '???')
          .join(' vs ')
      }`,
      completedAt: s.completedAt,
      entrants: s.slots.map(slot => slot.entrant)
        .filter(nonNull)
        .map((entrant, index) => ({
          name: entrant.name,
          participants: entrant.participants.map(p => ({
            serviceId: p.player.id.toString(),
            handle: p.player.gamerTag,
            prefix: p.prefix || (p.player.prefix || null),
            twitter: p.user?.authorizations?.[0].externalUsername || undefined,
          })),
          inLosers: isTrueFinals(match) || (isGrandFinals(match) && index === 1),
        })),
    };
  }

  public async eventIdForPhase(phaseId: string): Promise<string> {
    const resp: PhaseEventQueryResponse = await this.client.request(PHASE_EVENT_QUERY, { phaseId });
    return `${resp.phase.sets.nodes[0].event.id}`;
  }

  public async phasesForTournament(
    slug: SmashggSlug,
  ): Promise<{
      tournament: Tournament;
      events: TournamentEvent[];
      phases: TournamentPhase[];
      phaseGroups: TournamentPhaseGroup[];
    }> {
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
      phases: t.events.flatMap<TournamentPhase>(
        e => e.phases.map(
          p => ({
            id: p.id.toString(),
            name: p.name,
            eventId: e.id.toString(),
            url: getPhaseUrl(e, p),
            startAt: null,
          })
        )
      ),
      phaseGroups: t.events.flatMap<TournamentPhaseGroup>(
        e => e.phases.flatMap(
          p => p.phaseGroups.nodes.flatMap(
            pg => ({
              id: pg.id.toString(),
              phaseId: p.id.toString(),
              eventId: e.id.toString(),
              name: pg.displayIdentifier,
              url: getPhaseGroupUrl(e, p, pg),
            })
          )
        )
      ),
    };
  }

  public async setIdToPhaseGroup(phaseId: string): Promise<Record<string, TournamentPhaseGroup>> {
    const phase = (await this.client.request(PHASE_GROUP_SET_QUERY, {
      phaseId,
    }) as PhaseGroupSetQueryResponse).phase;
    const phaseGroups = phase ? phase.phaseGroups.nodes : [];
    if (phaseGroups.length < 2) {
      return {};
    }
    const mapping: Record<string, TournamentPhaseGroup> = {};
    for (const group of phaseGroups) {
      for (const set of group.sets.nodes) {
        // TODO: Get complete data?
        mapping[set.id.toString()] = {
          id: group.id.toString(),
          name: group.displayIdentifier,
          phaseId: phaseId,
          eventId: '',
          url: '',
        };
      }
    }
    return mapping;
  }

  public async eventInfo(eventId: string): Promise<{ tournament: Tournament; videogame: Game }> {
    const event = (await this.client.request(EVENT_QUERY, {
      eventId,
    }) as EventQueryResponse).event;
    if (!event) {
      throw new Error(`No event found with id ${eventId}`);
    }
    const videogame = getGameByServiceId(this.name(), event.videogame.id.toString()) ||
      Object.assign({}, nullGame, {
        name: event.videogame.name,
        serviceInfo: {
          smashgg: {
            id: event.videogame.id.toString(),
          }
        }
      });
    const tournament: Required<Tournament> = {
      ...event.tournament,
      id: event.tournament.id.toString(),
    };
    return { tournament, videogame };
  }

  public async phase(phaseId: string): Promise<TournamentPhase> {
    const phase = (await this.client.request(PHASE_QUERY, {
      phaseId,
    }) as PhaseQueryResponse).phase;
    if (!phase) {
      throw new Error(`No phase found with id ${phaseId}`);
    }
    return {
      id: phase.id.toString(),
      name: phase.name,
      eventId: phase.event.id.toString(),
      startAt: phase.waves?.[0]?.startAt,
      url: getPhaseUrl(phase.event, phase),
    };
  }
}

function getPhaseUrl(
  e: { slug: string },
  p: { id: number },
): string {
  return fullSmashggUrl(e.slug + `/brackets/${p.id}`);
}

function getPhaseGroupUrl(
  e: { slug: string },
  p: { id: number },
  pg: { id: number },
): string {
  return getPhaseUrl(e, p) + `/${pg.id}`;
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
