import Match from "./match";

export default interface TournamentSet {
  id: string;
  match: Match | null;
  shortIdentifier: string;
  displayName: string;
  entrants: {
    name: string;
    participants: {
      smashggId: string;
      handle: string;
      prefix: string | null;
      twitter: string | null;
    }[];
    inLosers?: boolean;
  }[];
}
