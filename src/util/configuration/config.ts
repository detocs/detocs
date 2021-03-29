import { resolve } from 'path';

import { tmpDir } from '@util/fs';
import { getLogger } from '@util/logger';

import { loadConfigData, findConfigData, emptyConfigData, parseConfig } from './common';
import cloneDeep from 'lodash.clonedeep';

const logger = getLogger('config');

export interface Config {
  credentialsFile?: string;
  databaseDirectory: string;
  peopleDatabaseFile: string;
  gameDatabaseFile?: string;
  logDirectory: string | null;
  clipDirectory: string;
  tempFileExpirationDays: number;
  vodKeyframeIntervalSeconds?: number;
  vodSingleVideoTemplate: string;
  vodPerSetTemplate: string;
  outputs: (WebSocketOutputConfig | FileOutputConfig)[];
  ports: {
    web: number;
  };
  obs: {
    address: string;
    password?: string;
  };
}

export type OutputTemplateConfig = string | {
  template: string;
  outputName: string;
};

export interface OutputConfig {
  templates: OutputTemplateConfig[];
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
  databaseDirectory: '.',
  peopleDatabaseFile: 'people.json',
  logDirectory: './detocs-logs',
  clipDirectory: tmpDir('clips'),
  tempFileExpirationDays: 5,
  vodSingleVideoTemplate: '$builtin/single-video.hbs',
  vodPerSetTemplate: '$builtin/per-set.hbs',
  outputs: [
    {
      type: 'file',
      path: '.',
      templates: [
        '$builtin/detocs-output.json.hbs'
      ],
    },
  ],
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
  const resolvedConfig = cloneDeep(config);

  const configRelative = <T extends string | null | undefined>(path: T): string | T =>
    path &&
    resolve(fileDir, path ?? '');
  resolvedConfig.credentialsFile = configRelative(resolvedConfig.credentialsFile);
  resolvedConfig.logDirectory = configRelative(resolvedConfig.logDirectory);
  resolvedConfig.clipDirectory = configRelative(resolvedConfig.clipDirectory);
  resolvedConfig.vodSingleVideoTemplate = configRelative(resolvedConfig.vodSingleVideoTemplate);
  resolvedConfig.vodPerSetTemplate = configRelative(resolvedConfig.vodPerSetTemplate);
  resolvedConfig.databaseDirectory = configRelative(resolvedConfig.databaseDirectory);

  const databaseRelative = <T extends string | null | undefined>(path: T): string | T =>
    path &&
    resolve(resolvedConfig.databaseDirectory, path ?? '');
  resolvedConfig.peopleDatabaseFile = databaseRelative(resolvedConfig.peopleDatabaseFile);
  resolvedConfig.gameDatabaseFile = databaseRelative(resolvedConfig.gameDatabaseFile);

  for (const output of resolvedConfig.outputs) {
    if (output.type == 'file') {
      output.path = configRelative(output.path);
    }
    output.templates = output.templates.map(tmpl => {
      if (typeof tmpl === 'string') {
        return configRelative(tmpl);
      } else {
        tmpl.template = configRelative(tmpl.template);
        return tmpl;
      }
    });
  }
  return resolvedConfig;
}
