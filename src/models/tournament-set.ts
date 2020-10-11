import Match from "./match";
import Game from "./game";

export interface TournamentParticipant {
  serviceId: string;
  handle: string;
  prefix: string | null;
  twitter?: string; // TODO: Generify
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
