import Match from "./match";
import Game from "./game";
import { SmashggId } from "./smashgg";

export default interface TournamentSet {
  id: SmashggId;
  match: Match | null;
  videogame: Game | null;
  shortIdentifier: string;
  displayName: string;
  entrants: {
    name: string;
    participants: {
      smashggId: SmashggId;
      handle: string;
      prefix: string | null;
      twitter: string | null;
    }[];
    inLosers?: boolean;
  }[];
}
