import { getLogger } from '@util/logger';

import path from 'path';
import express from 'express';

import { MediaServer } from '@server/media/server';
import { getAppRoot } from '@util/meta';

const logger = getLogger('web');

export default function({ port, mediaServer }: { port: number; mediaServer: MediaServer }): void {
  const app = express();
  app.use(express.static(path.join(getAppRoot(), '../public')));
  app.use(`/${mediaServer.getDirName()}`, express.static(mediaServer.getDir()));
  app.listen(port, () => logger.info(`Listening on port ${port}`));
}
