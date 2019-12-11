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
import { loadConfig, getConfig } from './util/config';
import { loadCredentials } from './util/credentials';
import { getVersion } from './util/meta';
import web from './web/server';

interface PersonExportOptions {
  sa?: boolean;
  sat?: boolean;
  sc?: boolean;
  sct?: boolean;
  destination?: string;
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
  await exportPeopleDatabase(format, opts.destination as string);
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
