import { getLogger } from '@util/logger.ts';

import path from 'path';
import express from 'express';

import { MediaServer } from '@server/media/server.ts';
import { getAppRoot } from '@util/meta.ts';

const logger = getLogger('web');

export default function({ port, mediaServer }: { port: number; mediaServer: MediaServer }): void {
  const app = express();
  app.use(express.static(path.join(getAppRoot(), '../public')));
  app.use(`/${mediaServer.getDirName()}`, express.static(mediaServer.getDir()));
  app.listen(port, () => logger.info(`Listening on port ${port}`));
}
