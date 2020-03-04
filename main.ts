import log4js, { Configuration } from 'log4js';

import 'isomorphic-fetch';
import moment from 'moment';
import { join } from 'path';
import yargs from 'yargs';

import ExportFormat from './export/export-format';
import exportPeopleDatabase from './export/export-people';
import {
  ScoreboardAssistantPeople,
  ScoreboardAssistantPeopleWithTwitter,
  StreamControlPeople,
  StreamControlPeopleWithTwitter,
} from './export/formats';
import server from './server/server';
import { VodUploader, Style, Command } from './upload/vod-uploader';
import { loadConfig, getConfig } from './util/config';
import { loadCredentials } from './util/credentials';
import { getVersion } from './util/meta';
import web from './web/server';

interface PersonExportOptions {
  sa?: boolean;
  sat?: boolean;
  sc?: boolean;
  sct?: boolean;
  destination: string;
}

interface VodOptions {
  logFile: string;
  command: string;
  ps: boolean;
}

yargs
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
        describe: 'use Scoreboard Assistant format',
        type: 'boolean',
        group: 'Formats',
      })
      .option('sat', {
        describe: 'use Scoreboard Assistant format (include Twitter handles)',
        type: 'boolean',
        group: 'Formats',
      })
      .option('sc', {
        describe: 'use Stream Control format',
        type: 'boolean',
        group: 'Formats',
      })
      .option('sct', {
        describe: 'use Stream Control format (include Twitter handles)',
        type: 'boolean',
        group: 'Formats',
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
        choices: ['metadata', 'video', 'dump', 'upload'],
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
  .strict()
  .parse();

async function startServer(): Promise<void> {
  enableBasicLogging();
  await loadConfig();
  configureLogger();
  logConfig();
  await loadCredentials();

  server();
  web();
}

async function exportPeople(opts: yargs.Arguments<PersonExportOptions>): Promise<void> {
  await loadConfig();

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
  await exportPeopleDatabase(format, opts.destination);
  process.exit();
};

async function vods(opts: yargs.Arguments<VodOptions>): Promise<void> {
  await loadConfig();
  await loadCredentials();

  let command = Command.Metadata;
  switch (opts.command) {
    case 'upload':
      command = Command.Upload;
      break;
    case 'dump':
      command = Command.Dump;
      break;
    case 'video':
      command = Command.Video;
      break;
  }
  const uploader = new VodUploader({
    logFile: opts.logFile,
    command,
    style: opts.ps ? Style.PerSet : Style.Full,
  });
  await uploader.run();
  process.exit();
};

function enableBasicLogging(): void {
  const logger = log4js.getLogger();
  logger.level = 'debug';
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
  const logger = log4js.getLogger('main');
  logger.info('Loaded config:', JSON.stringify(getConfig(), null, 2));
}
