import Tournament from '@models/tournament.ts';
import TournamentEvent from '@models/tournament-event.ts';
import TournamentPhase from '@models/tournament-phase.ts';
import TournamentSet from '@models/tournament-set.ts';
import TournamentPhaseGroup from '@models/tournament-phase-group.ts';

export default interface State {
  tournament: Tournament | null;
  tournamentId: string | null;
  events: TournamentEvent[];
  eventId: string | null;
  phases: TournamentPhase[];
  phaseId: string | null;
  phaseGroups: TournamentPhaseGroup[];
  phaseGroupIds: string[];
  unfinishedSets: TournamentSet[];
}

export const nullState: State = Object.freeze({
  tournament: null,
  tournamentId: null,
  events: [],
  eventId: null,
  phases: [],
  phaseId: null,
  phaseGroups: [],
  phaseGroupIds: [],
  unfinishedSets: [],
});
