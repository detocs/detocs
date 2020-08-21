import { SmashggId } from "@services/smashgg/types";

import Match from "./match";
import Game from "./game";

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
    participants: {
      smashggId: SmashggId; // TODO: per-service
      handle: string;
      prefix: string | null;
      twitter?: string;
    }[];
    inLosers?: boolean;
  }[];
}
