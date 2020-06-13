
import Tournament from '@models/tournament';
import TournamentEvent from '@models/tournament-event';
import TournamentPhase from '@models/tournament-phase';
import TournamentPhaseGroup from '@models/tournament-phase-group';
import TournamentSet from '@models/tournament-set';

export default interface BracketService {
  upcomingSetsByPhase(phaseId: string): Promise<TournamentSet[]>;
  eventIdForPhase(phaseId: string): Promise<string>;
  phasesForTournament(
    slug: string,
  ): Promise<{
    tournament: Tournament;
    events: TournamentEvent[];
    phases: TournamentPhase[];
    phaseGroups: TournamentPhaseGroup[];
  }>;
}
