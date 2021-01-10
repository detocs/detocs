import moment from 'moment';

import Game from '@models/game';
import { getGameById } from '@models/games';
import Match from '@models/match';
import { getMatchById, isGrandFinals, isTrueFinals } from '@models/matches';
import Tournament from '@models/tournament';
import TournamentEvent from '@models/tournament-event';
import TournamentPhase from '@models/tournament-phase';
import TournamentPhaseGroup from '@models/tournament-phase-group';
import TournamentSet from '@models/tournament-set';
import BracketService from '@services/bracket-service';
import { parseEntrantName } from '@services/challonge/challonge';
import { checkResponseStatus } from '@util/ajax';
import { nonNull } from '@util/predicates';

import { BASE_URL, BATTLEFY_SERVICE_NAME, TOURNAMENT_URL_REGEX } from './constants';
import {
  ApiEmptySlot,
  ApiMatch,
  ApiMatchSlot,
  ApiTournament,
  MatchResponse,
  Timestamp,
  TournamentResponse,
} from './types';

export default class BattlefyClient implements BracketService {
  public name(): string {
    return BATTLEFY_SERVICE_NAME;
  }

  public async upcomingSetsByPhase(stageId: string): Promise<TournamentSet[]> {
    const serviceName = this.name();
    const url = `${BASE_URL}/stages/${stageId}/matches`;
    const resp = await fetch(url)
      .then(checkResponseStatus)
      .then(resp => resp.json() as Promise<MatchResponse>);
    const maxRoundNum = resp.map(m => m.roundNumber)
      .reduce((a, b) => Math.max(a, b));
    return resp
      .filter(m => !m.isBye)
      .map(m => {
        const shortIdentifier = (m.matchType === 'winner' ? 'C' : 'L')
          + m.matchNumber.toString();
        const match = getMatch(maxRoundNum, m);
        const matchName = match ? match.id : m.roundNumber.toString();
        const videogame = getGameById('uni'); // TODO: Implement
        const entrants = [ m.top, m.bottom ].map((e: ApiMatchSlot | ApiEmptySlot, index) => {
          if (isEmptySlot(e)) {
            return null;
          }
          return {
            name: e.team.name,
            participants: e.team.playerIDs.map(id => ({
              serviceName,
              serviceId: id,
              ...parseEntrantName(e.team.name),
              serviceIds: {},
            })),
            inLosers: isTrueFinals(match) || (isGrandFinals(match) && index === 1),
          };
        });
        return {
          serviceInfo: {
            serviceName,
            id: m._id,
            phaseId: m.stageID,
            phaseGroupId: m.stageID,
          },
          match,
          videogame,
          shortIdentifier,
          displayName: `${shortIdentifier} - ${matchName}: ${
            entrants
              .map(e => e ? e.name : '???')
              .join(' vs ')
          }`,
          completedAt: null, // TODO: Parse timestamp
          entrants: entrants.filter(nonNull),
        };
      });
  }

  public async eventIdForPhase(stageId: string): Promise<string> {
    // TODO: Implement
    return stageId;
  }

  public async phasesForTournament(
    tournamentId: string,
  ): Promise<{
      tournament: Tournament;
      events: TournamentEvent[];
      phases: TournamentPhase[];
      phaseGroups: TournamentPhaseGroup[];
    }> {
    const url = `${BASE_URL}/tournaments/${tournamentId}` +
      '?extend[organization][%24opts][slug]=1&extend[stages][%24opts][name]=1';
    const resp = await fetch(url)
      .then(checkResponseStatus)
      .then(resp => resp.json() as Promise<TournamentResponse>);
    const apiTournament = resp[0];
    const tournament = convertTournament(apiTournament);
    const stages = apiTournament.stages.map(s => convertStage(apiTournament, s));
    return {
      tournament,
      events: stages,
      phases: stages.map(s => ({
        ...s,
        name: 'Bracket',
        eventId: s.id,
      })),
      phaseGroups: stages.map(s => ({
        ...s,
        name: 'Bracket',
        eventId: s.id,
        phaseId: s.id,
      })),
    };
  }

  public async eventInfo(eventId: string): Promise<{ tournament: Tournament; videogame: Game; }> {
    throw new Error("Method not implemented.");
  }

  public async phase(stageId: string): Promise<TournamentPhase> {
    throw new Error("Method not implemented.");
  }
}

export function parseTournamentId(url: string): string | null {
  const match = TOURNAMENT_URL_REGEX.exec(url);
  if (!match) {
    return null;
  }
  return match[1];
}

function getMatch(maxRoundNum: number, m: ApiMatch): Match | null {
  switch (maxRoundNum - m.roundNumber) {
    case 0:
      return getMatchById('tf');
    case 1:
      if (m.matchType === 'winner') {
        return getMatchById('gf');
      } else {
        return getMatchById('lf');
      }
    case 2:
      if (m.matchType === 'winner') {
        return getMatchById('wf');
      } else {
        return getMatchById('ls');
      }
    case 3:
      if (m.matchType === 'winner') {
        return getMatchById('ws');
      } else {
        return getMatchById('lq');
      }
    case 4:
      if (m.matchType === 'winner') {
        return getMatchById('wq');
      } else {
        return getMatchById(`l${m.roundNumber}`);
      }
    default:
      if (m.matchType === 'winner') {
        return getMatchById(`w${m.roundNumber}`);
      } else {
        return getMatchById(`l${m.roundNumber}`);
      }
  }
}

function isEmptySlot(
  slot: ApiMatchSlot | ApiEmptySlot
): slot is ApiEmptySlot {
  return slot.teamID == null;
}

function convertStage(t: ApiTournament, s: ApiTournament['stages'][0]): TournamentEvent {
  return {
    id: s._id,
    name: s.name,
    url: `https://battlefy.com/${t.organization.slug}/${t.slug}/${t._id}/stage/${s._id}/bracket/`,
  };
}

function convertTournament(t: ApiTournament): Tournament {
  return {
    id: t._id,
    name: t.name,
    url: `https://battlefy.com/${t.organization.slug}/${t.slug}/${t._id}/info`,
    startAt: parseTimestamp(t.startTime),
  };
}

function parseTimestamp(timestamp: Timestamp | null): number | null {
  return timestamp != null ? moment(timestamp).unix() : null;
}
