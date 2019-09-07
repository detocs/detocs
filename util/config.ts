import log4js from 'log4js';
const logger = log4js.getLogger('config');

import { dirname, join } from "path";
import { readFileSync, writeFileSync } from "fs";

interface Config {
  databaseDirectory: string;
  obsWebsocketPort: number;
}

const DEFAULTS: Config = {
  databaseDirectory: './databases',
  obsWebsocketPort: 4444,
};
let currentConfig = DEFAULTS;

export function getConfig(): Config {
  return currentConfig;
}

export async function loadConfig(): Promise<void> {
  const { config } = await loadConfigFile('detocs-config.json', DEFAULTS);
  currentConfig = config;
}

export async function loadConfigFile<T>(
  fileName: string,
  defaults: T,
): Promise<{config: T; filePath: string}>
{
  let dir: string | null = process.cwd();
  do {
    const filePath = join(dir, fileName);
    try {
      const data = readFileSync(filePath);
      logger.info(`Loading config from ${filePath}`);
      return {
        config: parseConfig(data, defaults, dir),
        filePath,
      };
    } catch { /* continue */ }
  } while (dir = getParentDir(dir));
  logger.info(`Unable to load ${fileName}, using defaults`);
  return {
    config: defaults,
    filePath: join(process.cwd(), fileName),
  };
}

export async function saveConfigFile<T>(filePath: string, config: T): Promise<void> {
  writeFileSync(filePath, JSON.stringify(config));
}

function parseConfig<T>(data: Buffer, defaults: T, dir: string): T {
  let parsed: Record<string, string> = JSON.parse(data.toString());
  for (const key of Object.keys(parsed)) {
    if (key.endsWith('Directory')) {
      parsed[key] = join(dir, parsed[key]);
    }
  }
  const config = Object.assign({}, defaults, parsed);
  logger.info('Loaded config:', config);
  return config;
}

function getParentDir(path: string | null): string | null {
  if (path == null) {
    return null;
  }
  const parent = dirname(path);
  if (parent === path) {
    return null;
  }
  return parent;
}
