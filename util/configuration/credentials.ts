import { ApiKey as ChallongeApiKey } from '@services/challonge/types';
import { ApiToken as SmashggApiToken } from '@services/smashgg/types';
import { AccessToken as Twitter } from '@models/twitter';
import { Credentials as YoutubeCredentials } from '@models/youtube';
import { getLogger } from '@util/logger';

import {
  saveConfigFile,
  loadConfigData,
  findConfigData,
  emptyConfigData,
  parseConfig
} from "./common";

const logger = getLogger('config');

// TODO: Make credentials immutable, add setCredentials
export interface Credentials {
  smashggKey?: SmashggApiToken;
  challongeKey?: ChallongeApiKey;
  twitterKey?: string;
  twitterSecret?: string;
  twitterToken?: Twitter;
  googleKey?: string;
  googleSecret?: string;
  youtubeToken?: YoutubeCredentials;
}

const DEFAULTS: Credentials = {};
let currentCreds = DEFAULTS;
let credsFile: string | null = null;

export function getCredentials(): Credentials {
  return currentCreds;
}

export async function loadCredentials(credentialsPath?: string): Promise<void> {
  const { data, configPath: loadedCredentialsPath } =
    (credentialsPath && await loadConfigData(credentialsPath)) ||
    await findConfigData('detocs-credentials.json') ||
    emptyConfigData();
  if (loadedCredentialsPath) {
    logger.info(`Loading credentials from ${loadedCredentialsPath}`);
    credsFile = loadedCredentialsPath;
  }
  currentCreds = parseConfig(data, DEFAULTS);
}

export async function saveCredentials(): Promise<void> {
  if (!credsFile) {
    throw new Error('Attempted to save credentials before loading');
  }
  await saveConfigFile(credsFile, currentCreds);
}
