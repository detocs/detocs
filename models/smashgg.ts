export type ApiToken = string;
export type SmashggId = string;
export type SmashggSlug = string;

export const TOURNAMENT_SLUG_REGEX = /[\w-]+/;
export const TOURNAMENT_URL_REGEX = /https?:\/\/(?:www\.)?smash.gg(?:\/admin)?\/tournament\/([\w-]+)(?:\/.*)?/;
export const SMASHGG_BASE_URL = 'https://smash.gg';
