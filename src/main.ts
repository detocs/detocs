#!/usr/bin/env node
import log4js, { Configuration } from 'log4js';

import 'isomorphic-fetch';
import moment from 'moment';
import ObsWebSocket from 'obs-websocket-js';
import { join } from 'path';
import yargs from 'yargs';

import app from '@desktop/app';
import ExportFormat from '@export/export-format';
import exportPeopleDatabase from '@export/export-people';
import {
  ScoreboardAssistantPeople,
  ScoreboardAssistantPeopleWithTwitter,
  StreamControlPeople,
  StreamControlPeopleWithTwitter,
} from '@export/formats';
import importPeopleDatabase from '@import/import-people';
import { MediaServer } from '@server/media/server';
import server from '@server/server';
import BracketServiceProvider from '@services/bracket-service-provider';
import ChallongeClient from '@services/challonge/challonge';
import { CHALLONGE_SERVICE_NAME } from '@services/challonge/constants';
import { ObsConnectionImpl } from '@services/obs/connection';
import ObsClient from '@services/obs/obs';
import { SMASHGG_SERVICE_NAME } from '@services/smashgg/constants';
import SmashggClient from '@services/smashgg/smashgg';
import { VodUploader, Style, Command } from '@upload/vod-uploader';
import { loadConfig, getConfig } from '@util/configuration/config';
import { loadCredentials } from '@util/configuration/credentials';
import { sortedKeys } from '@util/json';
import { getBasicLogger } from '@util/logger';
import { getVersion, setAppRoot, isPackagedApp } from '@util/meta';
import web from '@web/server';

interface ConfigOptions {
  config?: string;
  credentials?: string;
}

interface PersonExportOptions {
  sa?: boolean;
  sat?: boolean;
  sc?: boolean;
  sct?: boolean;
  destination: string;
}

interface PersonImportOptions {
  source: string;
}

interface VodOptions {
  logFile: string;
  command: string;
  ps: boolean;
}

setAppRoot(__dirname);
const logger = getBasicLogger();
const VERSION = getVersion();
process.title = `DETOCS ${VERSION}`;

const parser = yargs
  .option('config', {
    alias: 'c',
    type: 'string',
    global: true,
  })
  .option('credentials', {
    alias: 'k',
    type: 'string',
    global: true,
  })
  .middleware([
    middlewareLoadConfig,
    middlewareLoadCredentials,
  ])
  .command({
    command: 'server',
    aliases: '$0',
    describe: 'start server',
    handler: startServer,
  })
  .command({
    command: 'export-people <destination>',
    describe: 'export person database',
    handler: exportPeople,
    builder: (y: yargs.Argv<{}>): yargs.Argv<PersonExportOptions> => y
      .positional('destination', {
        describe: 'output file path',
        type: 'string',
        demandOption: 'you must provide a destination path',
      })
      .option('sa', {
        alias: 'scoreboard-assistant',
        describe: 'use Scoreboard Assistant format',
        type: 'boolean',
        group: 'Formats',
      })
      .option('sat', {
        alias: 'scoreboard-assistant-twitter',
        describe: 'use Scoreboard Assistant format (include Twitter handles)',
        type: 'boolean',
        group: 'Formats',
      })
      .option('sc', {
        alias: 'stream-control',
        describe: 'use Stream Control format',
        type: 'boolean',
        group: 'Formats',
      })
      .option('sct', {
        alias: 'stream-control-twitter',
        describe: 'use Stream Control format (include Twitter handles)',
        type: 'boolean',
        group: 'Formats',
      }),
  })
  .command({
    command: 'import-people <source>',
    describe: 'import people into database',
    handler: importPeople,
    builder: (y: yargs.Argv<{}>): yargs.Argv<PersonImportOptions> => y
      .positional('source', {
        describe: 'input file path (CSV only)',
        type: 'string',
        demandOption: 'you must provide a source path',
      }),
  })
  .command({
    command: 'vod <logFile> [command]',
    describe: 'cut vods and upload to YouTube',
    handler: vods,
    builder: (y: yargs.Argv<{}>): yargs.Argv<VodOptions> => y
      .positional('logFile', {
        describe: 'DETOCS recording log file',
        type: 'string',
        demandOption: 'you must provide a detocs log file',
      })
      .positional('command', {
        describe: 'upload to YouTube',
        type: 'string',
        choices: ['metadata', 'video', 'upload'],
        default: 'metadata',
      })
      .option('ps', {
        alias: 'per-set',
        describe: 'One video per set',
        type: 'boolean',
        default: false,
        group: 'Options',
      }),
  })
  .help('h')
  .alias('h', 'help')
  .version(getVersion())
  .strict();
if (isPackagedApp()) {
  parser.parse(process.argv.slice(1));
} else {
  parser.parse();
}

async function middlewareLoadConfig(args: yargs.Arguments<ConfigOptions>): Promise<void> {
  await loadConfig(args.config);
}

async function middlewareLoadCredentials(args: yargs.Arguments<ConfigOptions>): Promise<void> {
  await loadCredentials(args.credentials || getConfig().credentialsFile);
}

async function startServer(): Promise<void> {
  configureLogger();
  logConfig();

  const obsConn = new ObsConnectionImpl(new ObsWebSocket());
  const obsClient = new ObsClient(obsConn);
  obsConn.connect().catch(logger.warn);

  const mediaServer = new MediaServer({ obsClient, dirName: 'media' });
  mediaServer.start();

  const bracketProvider = getBracketProvider();

  server({ bracketProvider, mediaServer, obsClient });
  const port = getConfig().ports.web;
  web({ mediaServer, port });
  if (isPackagedApp()) {
    app({ port });
  }
}

async function exportPeople(opts: yargs.Arguments<PersonExportOptions>): Promise<void> {
  let format: ExportFormat = '';
  switch (true) {
    case opts.sa:
      format = ScoreboardAssistantPeople;
      break;
    case opts.sat:
      format = ScoreboardAssistantPeopleWithTwitter;
      break;
    case opts.sc:
      format = StreamControlPeople;
      break;
    case opts.sct:
      format = StreamControlPeopleWithTwitter;
      break;
    default:
      throw new Error('output format must be specified');
      break;
  }
  await exportPeopleDatabase(format, opts.destination)
    .catch(err => {
      logger.error(err);
      process.exit(1);
    });
  process.exit();
};

async function importPeople(opts: yargs.Arguments<PersonImportOptions>): Promise<void> {
  await importPeopleDatabase(opts.source)
    .catch(err => {
      logger.error(err);
      process.exit(1);
    });
  process.exit();
};

async function vods(opts: yargs.Arguments<VodOptions>): Promise<void> {
  let command = Command.Metadata;
  switch (opts.command) {
    case 'upload':
      command = Command.Upload;
      break;
    case 'video':
      command = Command.Video;
      break;
  }
  const uploader = new VodUploader({
    bracketProvider: getBracketProvider(),
    logFile: opts.logFile,
    command,
    style: opts.ps ? Style.PerSet : Style.Full,
  });
  await uploader.run()
    .catch(err => {
      logger.error(err);
      process.exit(1);
    });
  process.exit();
};

function configureLogger(): void {
  const appenders: Configuration['appenders'] = {
    'out': { type: 'stdout' },
  };
  const logDir = getConfig().logDirectory;
  if (logDir) {
    const timestamp = moment().toISOString(true).replace(/:/g, '-');
    appenders['app'] = {
      type: 'file',
      filename: join(logDir, `${timestamp}.log`),
    };
  }
  log4js.configure({
    appenders,
    categories: {
      default: {
        appenders: Object.keys(appenders),
        level: 'debug',
      },
    },
  });
}

function logConfig(): void {
  logger.info('Loaded config:', JSON.stringify(getConfig(), sortedKeys(getConfig()), 2));
}

function getBracketProvider(): BracketServiceProvider {
  const bracketProvider = new BracketServiceProvider();
  bracketProvider.register(SMASHGG_SERVICE_NAME, () => new SmashggClient());
  bracketProvider.register(CHALLONGE_SERVICE_NAME, () => new ChallongeClient());
  return bracketProvider;
}
