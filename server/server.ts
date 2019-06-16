import startControlServer from './control/server';
import startInfoServer from './info/server';
import startRecordingServer from './recording/server';

import { getLogger } from 'log4js';
import { CONTROL_PORT, INFO_PORT, RECORDING_PORT } from './ports';
const logger = getLogger('server');

export default function(): void {
  startControlServer(CONTROL_PORT);
  startInfoServer(INFO_PORT);
  startRecordingServer(RECORDING_PORT);
};
