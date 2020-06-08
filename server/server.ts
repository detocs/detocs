import { getLogger } from '@util/logger';

import startBracketServer from './bracket/server';
import startClipServer from './clip/server';
import startControlServer from './control/server';
import startInfoServer from './info/server';
import { MediaServer } from './media/server';
import {
  CONTROL_PORT,
  INFO_PORT,
  RECORDING_PORT,
  TWITTER_PORT,
  BRACKETS_PORT,
  MEDIA_DASHBOARD_PORT,
} from './ports';
import startRecordingServer from './recording/server';
import startTwitterServer from './twitter/server';

const logger = getLogger('server');

export default function start(mediaServer: MediaServer): void {
  logger.info('DETOCS server initializing...');
  startControlServer(CONTROL_PORT);
  startInfoServer(INFO_PORT);
  startRecordingServer(RECORDING_PORT, mediaServer);
  startTwitterServer(TWITTER_PORT, mediaServer);
  startBracketServer(BRACKETS_PORT);
  startClipServer(MEDIA_DASHBOARD_PORT, mediaServer);
};
