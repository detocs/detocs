import { SmashggId } from "./smashgg";

export default interface TournamentPhase {
  id: SmashggId;
  eventId: SmashggId;
  name: string;
  url: string;
}
