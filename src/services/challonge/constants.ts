export const CHALLONGE_SERVICE_NAME = 'challonge';
export const BASE_URL = 'https://api.challonge.com/v1';
export const TOURNAMENT_ID_REGEX = /[\w-]+/;
export const TOURNAMENT_URL_REGEX =
  /(?:https?:\/\/)?(?:(\w+)\.)?challonge.com\/([\w-]+)(?:\/.*)?/;
export const RESERVED_URLS = new Set([
  'connect',
  'events',
  'features',
  'pricing',
  'search',
  'terms_of_service',
  'tournament',
  'user_session',
  'users',
]);
