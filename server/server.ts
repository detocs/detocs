import startControlServer from './control/server';
import startInfoServer from './info/server';

import { getLogger } from 'log4js';
const logger = getLogger('server');

export default function() {
  const CONTROL_PORT = 58585;
  startControlServer(CONTROL_PORT);

  const INFO_PORT = 58586;
  startInfoServer(INFO_PORT);
};
