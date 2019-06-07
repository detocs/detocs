import startControlServer from './control/server';
import startInfoServer from './info/server';
import startRecordingServer from './recording/server';

import { getLogger } from 'log4js';
const logger = getLogger('server');

export default function(): void {
  const CONTROL_PORT = 58585;
  startControlServer(CONTROL_PORT);

  const INFO_PORT = 58586;
  startInfoServer(INFO_PORT);

  const RECORDING_PORT = 58587;
  startRecordingServer(RECORDING_PORT);
};
