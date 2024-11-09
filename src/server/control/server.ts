import * as ws from 'ws';

import { getLogger } from '@util/logger';

const logger = getLogger('server/control');

export default function start(port: number): void {
  logger.info('Initializing overlay control server');
  const controlServer = new ws.Server({ port });

  controlServer.on('connection', function connection(ws) {
    ws.on('message', function incoming(data: object) {
      logger.debug('Received: %s', data);
      // Broadcast to everyone else.
      controlServer.clients.forEach(function each(client) {
        if (client !== ws && client.readyState === ws.OPEN) {
          client.send(data);
        }
      });
    });
  });
}
