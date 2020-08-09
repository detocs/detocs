export default interface Tournament {
  id: string;
  name: string;
  url: string;
  venueName?: string | null;
  venueAddress?: string | null;
  city?: string | null;
  hashtag?: string | null;
  startAt?: number | null;
  endAt?: number | null;
  timezone?: string | null;
}
