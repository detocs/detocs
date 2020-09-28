import { resolve } from "path";

import { tmpDir } from '@util/fs';
import { getLogger } from '@util/logger';

import { loadConfigData, findConfigData, emptyConfigData, parseConfig } from './common';

const logger = getLogger('config');

export interface Config {
  credentialsFile?: string;
  databaseDirectory: string;
  peopleDatabaseFile: string;
  logDirectory: string | null;
  clipDirectory: string;
  tempFileExpirationDays: number;
  outputs: (WebSocketOutputConfig | FileOutputConfig)[];
  ports: {
    web: number;
  };
  obs: {
    address: string;
    password?: string;
  };
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
  tempFileExpirationDays: 5,
  outputs: [],
  ports: {
    web: 8080,
  },
  obs: {
    address: 'localhost:4444',
    password: undefined,
  }
};
let currentConfig = DEFAULTS;

export function getConfig(): Config {
  return currentConfig;
}

export async function loadConfig(configPath?: string): Promise<void> {
  const { data, configDir, configPath: loadedConfigPath } =
    (configPath && await loadConfigData(configPath)) ||
    await findConfigData('detocs-config.json') ||
    emptyConfigData();
  if (loadedConfigPath) {
    logger.info(`Loading config from ${loadedConfigPath}`);
  } else {
    logger.info(`Using default config`);
  }
  let config = parseConfig(data, DEFAULTS);
  config = resolveConfigDirectories(config, configDir);
  currentConfig = config;
}

function resolveConfigDirectories(config: Config, fileDir: string): Config {
  const configRelative = (path: string): string => resolve(fileDir, path);
  const resolvedConfig = Object.assign({}, config);
  resolvedConfig.credentialsFile = resolvedConfig.credentialsFile &&
    configRelative(resolvedConfig.credentialsFile);
  resolvedConfig.databaseDirectory = configRelative(resolvedConfig.databaseDirectory);
  if (resolvedConfig.peopleDatabaseFile) {
    resolvedConfig.peopleDatabaseFile = resolve(
      resolvedConfig.databaseDirectory,
      resolvedConfig.peopleDatabaseFile);
  }
  if (resolvedConfig.logDirectory) {
    resolvedConfig.logDirectory = configRelative(resolvedConfig.logDirectory);
  }
  resolvedConfig.clipDirectory = configRelative(resolvedConfig.clipDirectory);
  for (const output of resolvedConfig.outputs) {
    if (output.type == 'file') {
      output.path = configRelative(output.path);
    }
    output.templates = output.templates.map(configRelative);
  }
  return resolvedConfig;
}
