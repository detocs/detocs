import { getLogger } from 'log4js';
const logger = getLogger('web');

import path from 'path';
import express from 'express';

import { MediaServer } from '@server/media/server';

declare global {
  const APP_ROOT: string;
}

export default function(mediaServer: MediaServer): void {
  const WEB_PORT = 8080;
  const app = express();
  app.use(express.static(path.join(APP_ROOT, 'web/public')));
  app.use(`/${mediaServer.getDirName()}`, express.static(mediaServer.getDir()));
  app.listen(WEB_PORT, () => logger.info(`Listening on port ${WEB_PORT}`));
};
