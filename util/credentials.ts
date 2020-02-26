import { ApiToken as Smashgg } from '../models/smashgg';
import { AccessToken as Twitter } from '../models/twitter';
import { AccessToken as Youtube } from '../models/youtube';

import { loadConfigFile, saveConfigFile } from './config';

interface Credentials {
  twitterAccessToken?: Twitter;
  smashggApiToken?: Smashgg;
  youtubeAccessToken?: Youtube;
}

const DEFAULTS: Credentials = {};
let currentCreds = DEFAULTS;
let credsFile: string | null = null;

export function getCredentials(): Credentials {
  return currentCreds;
}

export async function loadCredentials(): Promise<void> {
  const { config, filePath } = await loadConfigFile('detocs-credentials.json', DEFAULTS);
  currentCreds = config;
  credsFile = filePath;
}

export async function saveCredentials(): Promise<void> {
  if (!credsFile) {
    throw new Error('Attempted to save credentials before loading');
  }
  await saveConfigFile(credsFile, currentCreds);
}
