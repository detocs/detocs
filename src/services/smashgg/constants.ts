export const SMASHGG_SERVICE_NAME = 'smashgg';
export const ENDPOINT = 'https://api.start.gg/gql/alpha';
export const TOURNAMENT_SLUG_REGEX = /[\w-]+/;
export const TOURNAMENT_URL_REGEX =
  /(?:https?:\/\/)?(?:www\.)?(?:smash|start).gg(?:\/admin)?\/tournament\/([\w-]+)(?:\/event\/[\w-]+\/brackets(?:\/|\?filter=\{"phaseId":)(\d+))?/;
export const SMASHGG_BASE_URL = 'https://start.gg';
// start.gg API max query complexity
export const MAX_COMPLEXITY = 1000;
// start.gg API max page size. Surely Evo will never have more pools than this for a bracket, right?
export const MAX_PAGE_SIZE = 500;
export const RATE_LIMIT = 80;
export const RATE_LIMIT_PERIOD_MS = 60 * 1000;
