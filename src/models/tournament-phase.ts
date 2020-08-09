export default interface TournamentPhase {
  id: string;
  eventId: string;
  name: string;
  url: string;
  startAt?: number | null; // UNIX timestamp
}
