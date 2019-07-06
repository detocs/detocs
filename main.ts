import { getLogger } from 'log4js';
const logger = getLogger();
logger.level = 'debug';

import 'isomorphic-fetch';

import server from './server/server';
import { loadConfig } from './util/config';
import web from './web/server';

loadConfig();
server();
web();
