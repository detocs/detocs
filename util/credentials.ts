import { ApiToken } from '../models/smashgg';
import { AccessToken } from '../models/twitter';

import { loadConfigFile, saveConfigFile } from './config';

interface Credentials {
  twitterAccessToken?: AccessToken;
  smashggApiToken?: ApiToken;
}

const DEFAULTS: Credentials = {};
let currentCreds = DEFAULTS;
let credsFile: string | null = null;

export function getCredentials(): Credentials {
  return currentCreds;
}

export async function loadCredentials(): Promise<void> {
  console.log('loadCredentials');
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
