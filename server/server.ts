import BracketServiceProvider from '@services/bracket-service-provider';
import ChallongeClient from '@services/challonge/challonge';
import { SERVICE_NAME as CHALLONGE_SERVICE_NAME } from '@services/challonge/constants';
import SmashggClient, { SERVICE_NAME as SMASHGG_SERVICE_NAME } from '@services/smashgg';
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
  const bracketProvider = new BracketServiceProvider();
  bracketProvider.register(SMASHGG_SERVICE_NAME, () => new SmashggClient());
  bracketProvider.register(CHALLONGE_SERVICE_NAME, () => new ChallongeClient());
  startControlServer(CONTROL_PORT);
  startInfoServer(INFO_PORT);
  startRecordingServer({ port: RECORDING_PORT, mediaServer, bracketProvider });
  startTwitterServer(TWITTER_PORT, mediaServer);
  startBracketServer({ port: BRACKETS_PORT, bracketProvider });
  startClipServer(MEDIA_DASHBOARD_PORT, mediaServer);
};
