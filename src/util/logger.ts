import log4js, { Configuration } from 'log4js';
import moment from 'moment';
import { join } from 'path';

export interface LoggerFunction {
  (msg: unknown, ...args: unknown[]): void;
}

export interface Logger {
  debug: LoggerFunction;
  info: LoggerFunction;
  warn: LoggerFunction;
  error: LoggerFunction;
}

export function getLogger(name: string): Logger {
  const logger = log4js.getLogger(name);
  return {
    debug: logger.debug.bind(logger),
    info: logger.info.bind(logger),
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger),
  };
}

export function getBasicLogger(): Logger {
  const logger = log4js.getLogger();
  logger.level = 'debug';
  return {
    debug: logger.debug.bind(logger),
    info: logger.info.bind(logger),
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger),
  };
}

export function configureLogger(logDir?: string|null): void {
  const appenders: Configuration['appenders'] = {
    'out': { type: 'stdout' },
  };
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
