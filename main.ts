import log4js, { Configuration } from 'log4js';

import 'isomorphic-fetch';
import moment from 'moment';
import { join } from 'path';

import server from './server/server';
import { loadConfig, getConfig } from './util/config';
import { loadCredentials } from './util/credentials';
import web from './web/server';

async function main(): Promise<void> {
  await loadConfig();
  configureLogger();
  await loadCredentials();
  server();
  web();
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

main();
