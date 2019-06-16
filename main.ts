import { getLogger } from 'log4js';
const logger = getLogger();
logger.level = 'debug';

import 'isomorphic-fetch';

import server from './server/server';
import web from './web/server';

server();
web();
