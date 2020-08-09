import { getLogger } from '@util/logger';

import path from 'path';
import express from 'express';

import { MediaServer } from '@server/media/server';
import { getAppRoot } from '@util/meta';

const logger = getLogger('web');

export default function(mediaServer: MediaServer): void {
  const WEB_PORT = 8080;
  const app = express();
  app.use(express.static(path.join(getAppRoot(), '../public')));
  app.use(`/${mediaServer.getDirName()}`, express.static(mediaServer.getDir()));
  app.listen(WEB_PORT, () => logger.info(`Listening on port ${WEB_PORT}`));
};
