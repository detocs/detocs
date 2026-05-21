import { GameDatabase } from '@models/games.ts';
import PersonDatabase from '@models/people.ts';
import BracketServiceProvider from '@services/bracket-service-provider.ts';
import { TwitterClient } from '@services/twitter/twitter.ts';
import VisionMixer from '@services/vision-mixer-service.ts';
import { getConfig } from '@util/configuration/config.ts';
import { getLogger } from '@util/logger.ts';
import { getProductName } from '@util/meta.ts';

import startBracketServer from './bracket/server.ts';
import startClipServer from './clip/server.ts';
import startControlServer from './control/server.ts';
import startErrorServer from './errors/server.ts';
import startInfoServer from './info/server.ts';
import { MediaServer } from './media/server.ts';
import {
  CONTROL_PORT,
  INFO_PORT,
  RECORDING_PORT,
  TWITTER_PORT,
  BRACKETS_PORT,
  MEDIA_DASHBOARD_PORT,
  ERROR_REPORTING_PORT,
} from './ports.ts';
import startRecordingServer from './recording/server.ts';
import startTwitterServer from './twitter/server.ts';

const logger = getLogger('server');

interface ServerParams {
  gameDatabase: GameDatabase;
  bracketProvider: BracketServiceProvider;
  mediaServer: MediaServer;
  visionMixer: VisionMixer;
  personDatabase: PersonDatabase;
  twitterClient: TwitterClient;
}

export default function start({
  gameDatabase,
  bracketProvider,
  mediaServer,
  visionMixer,
  personDatabase,
  twitterClient,
}: ServerParams): Promise<void> {
  logger.info(`${getProductName()} server initializing...`);
  return Promise.all([
    startControlServer(CONTROL_PORT),
    startInfoServer({
      port: INFO_PORT,
      personDatabase,
      gameDatabase,
      outputConfigs: getConfig().outputs,
      defaultState: getConfig().defaultState,
    }),
    startRecordingServer({ port: RECORDING_PORT, mediaServer, bracketProvider, visionMixer }),
    startTwitterServer({ port: TWITTER_PORT, mediaServer, twitterClient }),
    startBracketServer({ port: BRACKETS_PORT, bracketProvider }),
    startClipServer({ port: MEDIA_DASHBOARD_PORT, mediaServer, visionMixer }),
    startErrorServer({ port: ERROR_REPORTING_PORT }),
  ]).then(() => { /* void */ });
}
