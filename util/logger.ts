import log4js from 'log4js';

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
