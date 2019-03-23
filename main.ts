import { getLogger } from 'log4js';
const logger = getLogger();
logger.level = 'debug';

import server from './server/server';
import web from './web/server';

server();
web();
