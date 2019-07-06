import log4js from 'log4js';
const logger = log4js.getLogger('config');

import { dirname, join } from "path";
import { readFileSync } from "fs";

// TODO: Proper serialization
interface Config {
  databaseDirectory: string;
}

const CONFIG_FILE_NAME = 'detocs-config.json';
const DEFAULTS: Config = {
  databaseDirectory: './databases',
};
let config = DEFAULTS;

export function getConfig(): Config {
  return config;
}

export function loadConfig(): void {
  let dir: string | null = process.cwd();
  do {
    const file = join(dir, CONFIG_FILE_NAME);
    try {
      const data = readFileSync(file);
      logger.info(`Loading config from ${file}`);
      parseConfig(data, dir);
      return;
    } catch { /* continue */ }
  } while (dir = getParentDir(dir));
}

function parseConfig(data: Buffer, dir: string): void {
  let parsed: Config = JSON.parse(data.toString());
  parsed.databaseDirectory = join(dir, parsed.databaseDirectory);
  config = Object.assign({}, DEFAULTS, parsed);
  logger.info('Loaded config:', config);
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
