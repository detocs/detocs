import Game from './game';
import Match from './match';
import Person from './person';

export interface TournamentParticipant extends Omit<Person, 'id' | 'alias'> {
  serviceName: string;
  serviceId: string;
}

export default interface TournamentSet {
  serviceInfo: {
    serviceName: string;
    id: string;
    phaseId: string;
  };
  match: Match | null;
  videogame: Game | null;
  shortIdentifier: string;
  displayName: string;
  completedAt: number | null;
  entrants: {
    name: string;
    participants: TournamentParticipant[];
    inLosers?: boolean;
  }[];
}
