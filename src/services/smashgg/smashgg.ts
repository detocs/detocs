import { GraphQLClient } from 'graphql-request';

import Game, { nullGame } from '@models/game';
import { getGameByServiceId } from '@models/games';
import { getMatchBySmashggId, isGrandFinals, isTrueFinals } from '@models/matches';
import Tournament from '@models/tournament';
import TournamentEvent from '@models/tournament-event';
import TournamentPhase from '@models/tournament-phase';
import TournamentPhaseGroup from '@models/tournament-phase-group';
import TournamentSet, { TournamentEntrant, TournamentParticipant } from '@models/tournament-set';
import BracketService from '@services/bracket-service';
import { getCredentials } from '@util/configuration/credentials';
import { nonNull } from '@util/predicates';

import {
  TOURNAMENT_URL_REGEX,
  SMASHGG_BASE_URL,
  ENDPOINT,
  SMASHGG_SERVICE_NAME,
  MAX_PAGE_SIZE,
} from './constants';
import { paginatedQuery } from './pagination';
import {
  ApiSet,
  ApiEntrant,
  ApiParticipant,
  PHASE_PHASEGROUP_QUERY,
  PhasePhaseGroupQueryResponse,
  PHASE_SET_QUERY,
  PhaseSetQueryResponse,
  PHASE_EVENT_QUERY,
  PhaseEventQueryResponse,
  TOURNAMENT_PHASES_BY_ID_QUERY,
  TOURNAMENT_PHASES_BY_SLUG_QUERY,
  TournamentPhasesQueryResponse,
  SET_QUERY,
  SetQueryResponse,
  EVENT_QUERY,
  EventQueryResponse,
  PHASE_QUERY,
  PhaseQueryResponse,
  TOURNAMENT_PARTICIPANTS_BY_ID_QUERY,
  TOURNAMENT_PARTICIPANTS_BY_SLUG_QUERY,
  TournamentParticipantsQueryResponse,
  TOURNAMENT_TEAMS_BY_ID_QUERY,
  TOURNAMENT_TEAMS_BY_SLUG_QUERY,
  TournamentTeamsQueryResponse,
} from './queries';
import { SmashggSlug } from './types';

// TODO: Propagate smash.gg errors
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
    const phaseGroups = await paginatedQuery({
      client: this.client,
      query: PHASE_PHASEGROUP_QUERY,
      params: { phaseId },
      extractor: (resp: PhasePhaseGroupQueryResponse) => resp.phase.phaseGroups,
      defaultPageSize: MAX_PAGE_SIZE,
    });
    const phaseGroupNameMaping = new Map(phaseGroups.map(
      ({ id, displayIdentifier }) => [ id, displayIdentifier ]
    ));
    const sets = await paginatedQuery({
      client: this.client,
      query: PHASE_SET_QUERY,
      params: { phaseId },
      extractor: (resp: PhaseSetQueryResponse) => resp.phase.sets,
    });
    return sets.map(s => this.convertSet(
      phaseId,
      s,
      phaseGroupNameMaping.get(s.phaseGroup.id) as string,
      phaseGroupNameMaping.size > 1,
    ));
  }

  public async set(setId: string): Promise<TournamentSet> {
    const resp: SetQueryResponse = await this.client.request(SET_QUERY, { setId });
    return this.convertSet(
      resp.set.phaseGroup.phase.id.toString(),
      resp.set,
      resp.set.phaseGroup.displayIdentifier.toString(),
      resp.set.phaseGroup.phase.groupCount > 1,
    );
  }

  private convertSet(
    phaseId: string,
    s: ApiSet,
    phaseGroupName: string,
    multiGroup: boolean,
  ): TournamentSet {
    const phaseGroupPrefix = multiGroup ? `${phaseGroupName} ` : '';
    const origMatch = getMatchBySmashggId(s.fullRoundText);
    let match = origMatch;
    if (match && multiGroup) {
      match = {
        ...match,
        id: '',
        name: phaseGroupPrefix + match?.name,
      };
    }
    const videogame = this.getGame(s.event.videogame.id.toString(), s.event.videogame.name);
    const matchName = origMatch ? origMatch.id : s.fullRoundText;
    const serviceName = this.name();
    return {
      serviceInfo: {
        serviceName,
        id: s.id.toString(),
        phaseId,
        phaseGroupId: s.phaseGroup.id.toString(),
      },
      match,
      videogame,
      shortIdentifier: s.identifier,
      displayName: `${phaseGroupPrefix}${s.identifier} - ${matchName}: ${
        s.slots
          .map(slot => slot.entrant ? getEntrantName(slot.entrant) : '???')
          .join(' vs ')
      }`,
      completedAt: s.completedAt,
      entrants: s.slots.map(slot => slot.entrant)
        .filter(nonNull)
        .map((entrant, index) => ({
          ...parseEntrant(serviceName, entrant),
          inLosers: isTrueFinals(match) || (isGrandFinals(match) && index === 1),
        })),
    };
  }

  public async eventIdForPhase(phaseId: string): Promise<string> {
    const resp: PhaseEventQueryResponse = await this.client.request(PHASE_EVENT_QUERY, { phaseId });
    return resp.phase.event.id.toString();
  }

  public async phasesForTournament(
    slugOrId: string,
  ): Promise<{
      tournament: Tournament;
      events: TournamentEvent[];
      phases: TournamentPhase[];
      phaseGroups: TournamentPhaseGroup[];
    }> {
    const resp: TournamentPhasesQueryResponse = +slugOrId
      ? await this.client.request(TOURNAMENT_PHASES_BY_ID_QUERY, { id: +slugOrId })
      : await this.client.request(TOURNAMENT_PHASES_BY_SLUG_QUERY, { slug: slugOrId });
    if (!resp.tournament) {
      throw new Error(`tournament "${slugOrId}" not found`);
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

  public async eventInfo(eventId: string): Promise<{ tournament: Tournament; videogame: Game }> {
    const event = (await this.client.request(EVENT_QUERY, {
      eventId,
    }) as EventQueryResponse).event;
    if (!event) {
      throw new Error(`No event found with id ${eventId}`);
    }
    const videogame = this.getGame(event.videogame.id.toString(), event.videogame.name);
    const tournament: Required<Tournament> = {
      ...event.tournament,
      id: event.tournament.id.toString(),
    };
    return { tournament, videogame };
  }

  private getGame(id: string, name: string): Game {
    return getGameByServiceId(this.name(), id) ||
      Object.assign({}, nullGame, {
        name,
        serviceInfo: {
          smashgg: {
            id,
          }
        }
      });
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

  public async entrantsForTournament(slugOrId: string): Promise<TournamentEntrant[]> {
    const serviceName = this.name();
    let entrants: TournamentEntrant[] = [];
    let params, participantsQuery, teamsQuery;
    if (+slugOrId) {
      params = { id: +slugOrId };
      participantsQuery = TOURNAMENT_PARTICIPANTS_BY_ID_QUERY;
      teamsQuery = TOURNAMENT_TEAMS_BY_ID_QUERY;
    } else {
      params = { slug: slugOrId };
      participantsQuery = TOURNAMENT_PARTICIPANTS_BY_SLUG_QUERY;
      teamsQuery = TOURNAMENT_TEAMS_BY_SLUG_QUERY;
    }

    const apiParticipants = await paginatedQuery({
      client: this.client,
      query: participantsQuery,
      params,
      extractor: (resp: TournamentParticipantsQueryResponse) => resp.tournament?.participants,
      defaultPageSize: MAX_PAGE_SIZE,
    });
    if (!apiParticipants) {
      throw new Error(`Unable to get participants for tournament "${slugOrId}"`);
    }
    entrants = entrants.concat(apiParticipants.map(p => ({
      name: p.player.gamerTag,
      participants: [parseParticipant(serviceName, p)],
    })));

    const apiTeams = await paginatedQuery({
      client: this.client,
      query: teamsQuery,
      params,
      extractor: (resp: TournamentTeamsQueryResponse) => resp.tournament?.teams,
      defaultPageSize: MAX_PAGE_SIZE,
    });
    if (!apiTeams) {
      throw new Error(`Unable to get participants for tournament "${slugOrId}"`);
    }
    entrants = entrants.concat(apiTeams.map(t => parseEntrant(serviceName, t.entrant)));

    return entrants;
  }
}

function parseEntrant(serviceName: string, entrant: ApiEntrant): TournamentEntrant {
  return {
    name: getEntrantName(entrant),
    participants: entrant.participants.map(parseParticipant.bind(null, serviceName)),
  };
}

function parseParticipant(serviceName: string, participant: ApiParticipant): TournamentParticipant {
  return {
    serviceName,
    serviceId: participant.player.id.toString(),
    handle: participant.player.gamerTag,
    prefix: getParticipantPrefix(participant),
    serviceIds: {
      'twitter': participant.user?.authorizations?.[0]?.externalUsername || undefined,
    },
  };
}

function getEntrantName(entrant: ApiEntrant): string {
  if (entrant?.participants.length == 1) {
    const p = entrant.participants[0];
    const prefix = getParticipantPrefix(p);
    return prefix ? `${prefix} | ${p.player.gamerTag}` : p.player.gamerTag;
  } else {
    return entrant.name;
  }
}

function getParticipantPrefix(p: ApiParticipant): string | null {
  const prefix = p.prefix || (p.player.prefix || null);
  return prefix && prefix.replace(/\s*\|+$/, '');
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
