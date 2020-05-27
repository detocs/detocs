import log4js from 'log4js';
const logger = log4js.getLogger('config');

import { dirname, join, resolve } from "path";
import { readFileSync, writeFileSync } from "fs";
import { tmpDir } from './fs';

interface Config {
  databaseDirectory: string;
  peopleDatabaseFile: string;
  logDirectory: string | null;
  clipDirectory: string;
  obsWebsocketPort: number;
  outputs: (WebSocketOutputConfig | FileOutputConfig)[];
}

export interface OutputConfig {
  templates: string[];
}

export type WebSocketOutputConfig = OutputConfig & {
  type: 'websocket';
  port: number;
};

export type FileOutputConfig = OutputConfig & {
  type: 'file';
  path: string;
};

const DEFAULTS: Config = {
  databaseDirectory: './databases',
  peopleDatabaseFile: 'people.json',
  logDirectory: null,
  clipDirectory: tmpDir('clips'),
  obsWebsocketPort: 4444,
  outputs: [],
};
let currentConfig = DEFAULTS;

export function getConfig(): Config {
  return currentConfig;
}

export async function loadConfig(): Promise<void> {
  const { config, fileDir } = await loadConfigFile('detocs-config.json', DEFAULTS);
  resolveConfigDirectories(config, fileDir);
  currentConfig = config;
}

function resolveConfigDirectories(config: Config, fileDir: string): void {
  const configRelative = (path: string): string => resolve(fileDir, path);
  config.databaseDirectory = configRelative(config.databaseDirectory);
  if (config.peopleDatabaseFile) {
    config.peopleDatabaseFile = resolve(config.databaseDirectory, config.peopleDatabaseFile);
  }
  if (config.logDirectory) {
    config.logDirectory = configRelative(config.logDirectory);
  }
  for (const output of config.outputs) {
    if (output.type == 'file') {
      output.path = configRelative(output.path);
    }
    output.templates = output.templates.map(configRelative);
  }
}

export async function loadConfigFile<T>(
  fileName: string,
  defaults: T,
): Promise<{config: T; filePath: string; fileDir: string}>
{
  let dir: string | null = process.cwd();
  do {
    const filePath = join(dir, fileName);
    try {
      const data = readFileSync(filePath);
      logger.info(`Loading config from ${filePath}`);
      return {
        config: parseConfig(data, defaults),
        filePath,
        fileDir: dir,
      };
    } catch { /* continue */ }
  } while (dir = getParentDir(dir));
  logger.info(`Unable to load ${fileName}, using defaults`);
  return {
    config: Object.assign({}, defaults),
    filePath: resolve(fileName),
    fileDir: process.cwd(),
  };
}

export async function saveConfigFile<T>(filePath: string, config: T): Promise<void> {
  writeFileSync(filePath, JSON.stringify(config, null, 2));
}

function parseConfig<T>(data: Buffer, defaults: T): T {
  let parsed: Partial<T> = JSON.parse(data.toString());
  const config = Object.assign({}, defaults, parsed);
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
