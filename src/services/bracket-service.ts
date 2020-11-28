import Game from '@models/game';
import Tournament from '@models/tournament';
import TournamentEvent from '@models/tournament-event';
import TournamentPhase from '@models/tournament-phase';
import TournamentPhaseGroup from '@models/tournament-phase-group';
import TournamentSet from '@models/tournament-set';

export default interface BracketService {
  name(): string;
  upcomingSetsByPhase(phaseId: string): Promise<TournamentSet[]>;
  eventIdForPhase(phaseId: string): Promise<string>;
  phasesForTournament(
    id: string,
  ): Promise<{
    tournament: Tournament;
    events: TournamentEvent[];
    phases: TournamentPhase[];
    phaseGroups: TournamentPhaseGroup[];
  }>;
  eventInfo(eventId: string): Promise<{
    tournament: Tournament;
    videogame: Game;
  }>;
  phase(phaseId: string): Promise<TournamentPhase>;
}
