import { SmashggId, SmashggSlug } from '@models/smashgg';
import Tournament from '@models/tournament';
import TournamentEvent from '@models/tournament-event';
import TournamentPhase from '@models/tournament-phase';
import TournamentSet from '@models/tournament-set';
import TournamentPhaseGroup from '@models/tournament-phase-group';

export default interface State {
  tournament: Tournament | null;
  tournamentId: SmashggSlug | null;
  events: TournamentEvent[];
  eventId: SmashggId | null;
  phases: TournamentPhase[];
  phaseId: SmashggId | null;
  phaseGroups: TournamentPhaseGroup[];
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
  unfinishedSets: [],
});
