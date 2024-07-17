import Game from '@models/game';
import Tournament from '@models/tournament';
import TournamentEvent from '@models/tournament-event';
import TournamentPhase from '@models/tournament-phase';
import TournamentPhaseGroup from '@models/tournament-phase-group';
import TournamentSet, { TournamentEntrant } from '@models/tournament-set';

// TODO: Settle on whether tournament methods should accept slugs
export default interface BracketService {
  name(): string;
  upcomingSetsByPhase(phaseId: string): Promise<TournamentSet[]>;
  upcomingSetsByPhaseGroup(phaseId: string, phaseGroupIds: string[]): Promise<TournamentSet[]>;
  eventIdForPhase(phaseId: string): Promise<string>;
  eventsForTournament(
    id: string,
  ): Promise<{
    tournament: Tournament;
    events: TournamentEvent[];
  }>;
  phasesForEvent(
    tournamentId: string,
    eventId: string,
  ): Promise<{
    phases: TournamentPhase[];
    phaseGroups: TournamentPhaseGroup[];
  }>;
  eventInfo(eventId: string): Promise<{
    tournament: Tournament;
    videogame: Game;
  }>;
  phase(phaseId: string): Promise<TournamentPhase>;
  entrantsForTournament(id: string): Promise<TournamentEntrant[]>;
}
