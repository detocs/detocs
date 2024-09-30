#!/usr/bin/env node
import 'isomorphic-fetch';
import { dirname, join } from 'path';
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
import ObsClient from '@services/obs/obs';
import ObsLegacyClient from '@services/obs-legacy/obs';
import { SMASHGG_SERVICE_NAME } from '@services/smashgg/constants';
import SmashggClient, { parseTournamentSlug as parseSmashggSlug } from '@services/smashgg/smashgg';
import { TwitterClient, ApiTwitterClient, MockTwitterClient } from '@services/twitter/twitter';
import VisionMixer from '@services/vision-mixer-service';
import { generateLog } from '@upload/log-generator';
import { VodUploader, Style, Command } from '@upload/vod-uploader';
import { getConfig, loadConfig } from '@util/configuration/config';
import { getCredentials, loadCredentials } from '@util/configuration/credentials';
import { sortedKeys } from '@util/json';
import { configureLogger, getBasicLogger } from '@util/logger';
import {
  getVersion,
  setAppRoot,
  getProductName,
  isElectron,
  isPkg,
} from '@util/meta';
import { withoutExtension } from '@util/path';
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
  n?: number;
  'skip-notifs'?: boolean;
}

interface GenerateLogOptions {
  bracketUrls: string[];
  folder?: string;
  vodfile?: string;
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
        choices: ['metadata', 'cut', 'upload', 'update'],
        default: 'metadata',
      })
      .option('ps', {
        alias: 'per-set',
        describe: 'One video per set',
        type: 'boolean',
        default: false,
        group: 'Options',
      })
      .option('n', {
        alias: 'video-num',
        describe: 'Which set to cut/upload/update (1-indexed)',
        type: 'number',
        group: 'Options',
      })
      .option('skip-notifs', {
        describe: 'Whether to skip notifying subscribers when the video is published. Can only be set at the time of upload.',
        type: 'boolean',
      }),
  })
  .command({
    command: 'generate-log <bracketUrls...>',
    describe: 'Generate log files for a bracket',
    handler: generateLogCommand,
    builder: (y: yargs.Argv<unknown>): yargs.Argv<GenerateLogOptions> => y
      .positional('bracketUrls', {
        describe: 'URLs for brackets to include. Must all be from the same service.',
        type: 'string',
        array: true,
        demandOption: 'you must provide at least one bracket URL',
      })
      .option('vodfile', {
        describe: 'Log file will be saved to folder based on vod filename',
        type: 'string',
        group: 'Output',
        normalize: true,
      })
      .option('folder', {
        describe: 'Folder to save log file in',
        type: 'string',
        group: 'Output',
        normalize: true,
      })
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
  configureLogger(getConfig().logDirectory);
  logConfig();

  const visionMixer = getVisionMixer();

  const mediaServer = new MediaServer({ visionMixer, dirName: 'media' });
  mediaServer.start();

  const bracketProvider = getBracketProvider();

  const personDatabase = new PersonDatabase(getConfig().peopleDatabaseFile);
  await personDatabase.loadDatabase();

  const port = getConfig().ports.web;
  const twitterClient = await getTwitterClient();
  await Promise.all([
    server({ bracketProvider, mediaServer, visionMixer, personDatabase, twitterClient }),
    web({ mediaServer, port }),
  ]);
  if (isElectron()) {
    startElectron({ port });
  } else if (isPkg()) {
    startLocalBrowser({ port });
  }
}

function getVisionMixer(): VisionMixer {
  const obsWebsocketVersion = getConfig().obs?.webSocketVersion;
  return obsWebsocketVersion && obsWebsocketVersion < 5
    ? ObsLegacyClient.getClient()
    : ObsClient.getClient();
}

export async function getTwitterClient(): Promise<TwitterClient> {
  const { twitterKey, twitterSecret } = getCredentials();
  if (!twitterKey || !twitterSecret) {
    logger.warn('Twitter API keys not found');
    return MockTwitterClient.getClient();
  } else {
    return await ApiTwitterClient.getClient({ twitterKey, twitterSecret });
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
    case 'update':
      command = Command.Update;
      break;
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
    videoNum: opts.n,
    skipNotification: opts['skip-notifs'],
  });
  await uploader.run()
    .catch(err => {
      logger.error(err);
      process.exit(1);
    });
  process.exit();
}

async function generateLogCommand({
  bracketUrls,
  folder,
  vodfile,
}: yargs.Arguments<GenerateLogOptions>): Promise<void> {
  const vodDir = vodfile && join(dirname(vodfile), withoutExtension(vodfile));
  (await generateLog({
    bracketProvider: getBracketProvider(),
    bracketUrls,
    outputFolder: vodDir ?? folder ?? process.cwd(),
    vodFile: vodfile ?? '',
  })).match(
    file => logger.info(`Log file successfully saved to ${file}`),
    logger.error,
  );
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
