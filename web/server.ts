import path from 'path';
import express from 'express';

import { getLogger } from 'log4js';
const logger = getLogger('web');

export default function() {
  const WEB_PORT = 8080;
  const app = express();
  app.use(express.static(path.join(__dirname, 'public')));
  app.use('/js', express.static(path.join(__dirname, 'js')));
  app.listen(WEB_PORT, () => logger.info(`Listening on port ${WEB_PORT}`));
};
