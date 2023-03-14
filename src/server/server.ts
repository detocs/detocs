import PersonDatabase from '@models/people';
import BracketServiceProvider from '@services/bracket-service-provider';
import { TwitterClient } from '@services/twitter/twitter';
import VisionMixer from '@services/vision-mixer-service';
import { getLogger } from '@util/logger';
import { getProductName } from '@util/meta';

import startBracketServer from './bracket/server';
import startClipServer from './clip/server';
import startControlServer from './control/server';
import startErrorServer from './errors/server';
import startInfoServer from './info/server';
import { MediaServer } from './media/server';
import {
  CONTROL_PORT,
  INFO_PORT,
  RECORDING_PORT,
  TWITTER_PORT,
  BRACKETS_PORT,
  MEDIA_DASHBOARD_PORT,
  ERROR_REPORTING_PORT,
} from './ports';
import startRecordingServer from './recording/server';
import startTwitterServer from './twitter/server';

const logger = getLogger('server');

interface ServerParams {
  bracketProvider: BracketServiceProvider;
  mediaServer: MediaServer;
  visionMixer: VisionMixer;
  personDatabase: PersonDatabase;
  twitterClient: TwitterClient;
}

export default function start({
  bracketProvider,
  mediaServer,
  visionMixer,
  personDatabase,
  twitterClient,
}: ServerParams): Promise<void> {
  logger.info(`${getProductName()} server initializing...`);
  return Promise.all([
    startControlServer(CONTROL_PORT),
    startInfoServer({ port: INFO_PORT, personDatabase }),
    startRecordingServer({ port: RECORDING_PORT, mediaServer, bracketProvider, visionMixer }),
    startTwitterServer({ port: TWITTER_PORT, mediaServer, twitterClient }),
    startBracketServer({ port: BRACKETS_PORT, bracketProvider }),
    startClipServer({ port: MEDIA_DASHBOARD_PORT, mediaServer, visionMixer }),
    startErrorServer({ port: ERROR_REPORTING_PORT }),
  ]).then(() => { /* void */ });
}
