import { SmashggId } from "./smashgg";

export default interface TournamentPhaseGroup {
  id: SmashggId;
  phaseId: SmashggId;
  eventId: SmashggId;
  name: string;
  url: string;
}
