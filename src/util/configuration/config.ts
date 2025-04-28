import { resolve } from 'path';

import { tmpDir } from '@util/fs';
import { getLogger } from '@util/logger';

import { loadConfigData, findConfigData, emptyConfigData, parseConfig } from './common';
import cloneDeep from 'lodash.clonedeep';
import State from '@server/info/state';

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
  vodSingleVideoTemplate?: never; // backwards-compatibility
  vodPerSetTemplate?: never; // backwards-compatibility
  defaultState: Partial<State>,
  recording: {
    splitOnGameChange: boolean;
  },
  templates: {
    vod: {
      singleVideo: {
        title: string;
        description: string;
      },
      perSet: {
        title: string;
        description: string;
      },
    }
  }
  outputs: (
    WebSocketOutputConfig
    | FileOutputConfig
    | WebSocketClientOutputConfig
    | HttpClientOutputConfig
  )[];
  ports: {
    web: number;
  };
  obs: {
    address: string;
    password?: string;
    binPath?: string;
    webSocketVersion?: number;
  };
  ffmpeg: {
    transcodeVideoInputArgs: string[];
    transcodeVideoOutputArgs: string[];
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

export type WebSocketClientOutputConfig = OutputConfig & {
  type: 'websocketClient';
  url: string;
  pingIntervalSeconds?: number;
  reconnectionDelaySeconds?: number;
};

export type HttpClientOutputConfig = OutputConfig & {
  type: 'httpClient';
  url: string;
  method?: string;
  headers?: Record<string, string>;
  // TODO: Figure out a flexible and reasonable elegant method for body
  // formatting. Templating?
  formDataName: string;
};

const DEFAULTS: Config = {
  databaseDirectory: '.',
  peopleDatabaseFile: 'people.json',
  logDirectory: './detocs-logs',
  clipDirectory: tmpDir('clips'),
  tempFileExpirationDays: 5,
  defaultState: {},
  recording: {
    splitOnGameChange: true,
  },
  templates: {
    vod: {
      singleVideo: {
        title: '$builtin/single-video-title.hbs',
        description: '$builtin/single-video.hbs',
      },
      perSet: {
        title: '$builtin/per-set-title.hbs',
        description: '$builtin/per-set.hbs',
      },
    },
  },
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
    address: 'localhost:4455',
    password: undefined,
    webSocketVersion: 5,
  },
  ffmpeg: {
    transcodeVideoInputArgs: [],
    transcodeVideoOutputArgs: [
      '-codec:v', 'libx264',
      '-crf', '18',
      '-threads', '2',
    ],
  },
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
  config = updateTemplateFields(config);
  config = resolveConfigDirectories(config, configDir);
  currentConfig = config;
}

const CONFIG_RELATIVE: Set<string> = new Set<keyof Config>([
  'credentialsFile',
  'logDirectory',
  'clipDirectory',
  'databaseDirectory',
]);
CONFIG_RELATIVE.add('binPath');

const DATABASE_RELATIVE: Set<string> = new Set<keyof Config>([
  'peopleDatabaseFile',
  'gameDatabaseFile',
]);

function resolveConfigDirectories(config: Config, fileDir: string): Config {
  const resolvedConfig = cloneDeep(config);

  const configRelative = <T extends string | null | undefined>(path: T): string | T =>
    path &&
    resolve(fileDir, path ?? '');
  walkObject(
    resolvedConfig as unknown as Record<string, string>,
    (keyPath, original) => {
      const firstKey = keyPath[0];
      const lastKey = keyPath[keyPath.length - 1];
      return (firstKey === 'templates' && typeof original === 'string')
      || CONFIG_RELATIVE.has(lastKey);
    },
    configRelative,
  );

  const databaseRelative = <T extends string | null | undefined>(path: T): string | T =>
    path &&
    resolve(resolvedConfig.databaseDirectory, path ?? '');
  walkObject(
    resolvedConfig as unknown as Record<string, string>,
    (keyPath) => {
      const lastKey = keyPath[keyPath.length - 1];
      return DATABASE_RELATIVE.has(lastKey);
    },
    databaseRelative,
  );

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

function walkObject<T>(
  obj: Record<string, T | object>,
  test: (keyPath: string[], original: unknown) => boolean,
  replaceFn: (original: T) => T,
  keyPath: string[] = [],
): void {
  for (const key of Object.keys(obj)) {
    const newPath = [...keyPath, key];
    if (test(newPath, obj[key])) {
      obj[key] = replaceFn(obj[key] as T);
    }
    if (typeof obj[key] === 'object') {
      walkObject(obj[key] as Record<string, T>, test, replaceFn, newPath);
    }
  }
}

/**
 * Backwards-compatibility for old fields
 */
function updateTemplateFields(originalConfig: Config): Config {
  const config = cloneDeep(originalConfig);
  if (config.vodSingleVideoTemplate) {
    config.templates.vod.singleVideo.description = config.vodSingleVideoTemplate;
    delete config.vodSingleVideoTemplate;
  }
  if (config.vodPerSetTemplate) {
    config.templates.vod.perSet.description = config.vodPerSetTemplate;
    delete config.vodPerSetTemplate;
  }
  return config;
}
