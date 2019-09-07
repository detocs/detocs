import startControlServer from './control/server';
import startInfoServer from './info/server';
import startRecordingServer from './recording/server';
import startTwitterServer from './twitter/server';

import { getLogger } from 'log4js';
import { CONTROL_PORT, INFO_PORT, RECORDING_PORT, TWITTER_PORT } from './ports';
const logger = getLogger('server');

export default function start(): void {
  logger.info('DETOCS server initializing...');
  startControlServer(CONTROL_PORT);
  startInfoServer(INFO_PORT);
  startRecordingServer(RECORDING_PORT);
  startTwitterServer(TWITTER_PORT);
};
