#!/usr/bin/env node
import 'isomorphic-fetch';
import log4js, { Configuration } from 'log4js';
import moment from 'moment';
import ObsWebSocket from 'obs-websocket-js';
import { join } from 'path';
import yargs from 'yargs';

import startElectron from '@desktop/electron';
import startLocalBrowser from '@desktop/local-browser';
import ExportFormat from '@export/export-format';
import exportPeopleDatabase from '@export/export-people';
import {
  ScoreboardAssistantPeople,
  ScoreboardAssistantPeopleWithTwitter,
  StreamControlPeople,
  StreamControlPeopleWithTwitter,
} from '@export/formats';
import { importPeopleDatabase, importTournamentEntrants } from '@import/import-people';
import PersonDatabase from '@models/people';
import { MediaServer } from '@server/media/server';
import server from '@server/server';
import BracketServiceProvider from '@services/bracket-service-provider';
import BattlefyClient, { parseTournamentId as parseBattlefyId } from '@services/battlefy/battlefy';
import { BATTLEFY_SERVICE_NAME } from '@services/battlefy/constants';
import ChallongeClient, {
  parseTournamentId as parseChallongeId,
} from '@services/challonge/challonge';
import { CHALLONGE_SERVICE_NAME } from '@services/challonge/constants';
import { ObsConnectionImpl } from '@services/obs/connection';
import ObsClient from '@services/obs/obs';
import { SMASHGG_SERVICE_NAME } from '@services/smashgg/constants';
import SmashggClient, { parseTournamentSlug as parseSmashggSlug } from '@services/smashgg/smashgg';
import { VodUploader, Style, Command } from '@upload/vod-uploader';
import { loadConfig, getConfig } from '@util/configuration/config';
import { loadCredentials } from '@util/configuration/credentials';
import { sortedKeys } from '@util/json';
import { getBasicLogger } from '@util/logger';
import {
  getVersion,
  setAppRoot,
  getProductName,
  isElectron,
  isPkg,
} from '@util/meta';
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
  file?: string;
  url?: string;
  destination?: string;
}

interface VodOptions {
  logFile: string;
  command: string;
  ps: boolean;
}

setAppRoot(__dirname);
const logger = getBasicLogger();

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const VERSION = getVersion();
const PRODUCT_NAME = getProductName();
process.title = `${PRODUCT_NAME} ${VERSION}`;

const parser = yargs
  .option('c', {
    alias: 'config',
    describe: 'Use the specified config file',
    type: 'string',
    global: true,
  })
  .option('k', {
    alias: 'credentials',
    describe: 'Use the specified credentials file',
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
    describe: `${PRODUCT_NAME} server`,
    handler: startServer,
  })
  .command({
    command: 'export-people <destination>',
    describe: 'Export people from the database',
    handler: exportPeople,
    builder: (y: yargs.Argv<unknown>): yargs.Argv<PersonExportOptions> => y
      .positional('destination', {
        describe: 'Output file path',
        type: 'string',
        demandOption: 'you must provide a destination path',
      })
      .option('sa', {
        alias: 'scoreboard-assistant',
        describe: 'Scoreboard Assistant format',
        type: 'boolean',
        group: 'Formats',
      })
      .option('sat', {
        alias: 'scoreboard-assistant-twitter',
        describe: 'Scoreboard Assistant format (include Twitter handles)',
        type: 'boolean',
        group: 'Formats',
      })
      .option('sc', {
        alias: 'stream-control',
        describe: 'StreamControl format',
        type: 'boolean',
        group: 'Formats',
      })
      .option('sct', {
        alias: 'stream-control-twitter',
        describe: 'StreamControl format (include Twitter handles)',
        type: 'boolean',
        group: 'Formats',
      }),
  })
  .command({
    command: 'import-people [destination]',
    describe: 'Import people into the database',
    handler: importPeople,
    builder: (y: yargs.Argv<unknown>): yargs.Argv<PersonImportOptions> => y
      .option('url', {
        describe: 'Input bracket service URL',
        type: 'string',
        group: 'Source',
      })
      .option('file', {
        describe: 'Input file path (CSV only)',
        type: 'string',
        group: 'Source',
      })
      .positional('destination', {
        describe: 'Output file path',
        type: 'string',
      }),
  })
  .command({
    command: 'vod <logFile> [command]',
    describe: 'Cut vods and upload them to YouTube',
    handler: vods,
    builder: (y: yargs.Argv<unknown>): yargs.Argv<VodOptions> => y
      .positional('logFile', {
        describe: `${PRODUCT_NAME} recording log file`,
        type: 'string',
        demandOption: 'you must provide a detocs log file',
      })
      .positional('command', {
        type: 'string',
        choices: ['metadata', 'cut', 'upload'],
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
  .version(VERSION)
  .strict();
if (isElectron()) {
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

  const personDatabase = new PersonDatabase(getConfig().peopleDatabaseFile);
  await personDatabase.loadDatabase();

  const port = getConfig().ports.web;
  await Promise.all([
    server({ bracketProvider, mediaServer, obsClient, personDatabase }),
    web({ mediaServer, port }),
  ]);
  if (isElectron()) {
    startElectron({ port });
  } else if (isPkg()) {
    startLocalBrowser({ port });
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
  const database = new PersonDatabase(getConfig().peopleDatabaseFile);
  await database.loadDatabase();
  await exportPeopleDatabase(database, format, opts.destination)
    .catch(err => {
      logger.error(err);
      process.exit(1);
    });
  process.exit();
}

async function importPeople(opts: yargs.Arguments<PersonImportOptions>): Promise<void> {
  if (!opts.file && !opts.url) {
    throw new Error('file or url must be provided');
  }
  const database = new PersonDatabase(opts.destination || getConfig().peopleDatabaseFile);
  await database.loadDatabase();
  if (opts.file) {
    await importPeopleDatabase(database, opts.file)
      .catch((err: Error) => {
        logger.error(err);
        process.exit(1);
      });
  }
  if (opts.url) {
    const bracketProvider = getBracketProvider();
    await importTournamentEntrants(database, bracketProvider, opts.url)
      .catch((err: Error) => {
        logger.error(err);
        process.exit(1);
      });
  }
  process.exit();
}

async function vods(opts: yargs.Arguments<VodOptions>): Promise<void> {
  let command = Command.Metadata;
  switch (opts.command) {
    case 'upload':
      command = Command.Upload;
      break;
    case 'cut':
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
}

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
  bracketProvider.register(SMASHGG_SERVICE_NAME, parseSmashggSlug, () => new SmashggClient());
  bracketProvider.register(CHALLONGE_SERVICE_NAME, parseChallongeId, () => new ChallongeClient());
  bracketProvider.register(BATTLEFY_SERVICE_NAME, parseBattlefyId, () => new BattlefyClient());
  return bracketProvider;
}
