import { getLogger } from 'log4js';
const logger = getLogger('output/websocket');

import * as WebSocket from 'ws';

import { WebSocketOutputConfig } from '@util/config';
import { broadcastAllData, sendAllData } from '@util/websocket';
import State from '@server/info/state';
import Output from '@server/info/output/output';
import { OutputTemplate, parseTemplateFile } from '@server/info/output/templates';


export default class WebSocketOutput implements Output {
  private readonly port: number;
  private readonly templateFiles: string[];
  private templates: OutputTemplate[] = [];
  private server: WebSocket.Server | undefined;
  private currentData: string[] = [];

  public constructor({ port, templates }: WebSocketOutputConfig) {
    this.port = port;
    this.templateFiles = templates;
  }

  public async init(): Promise<void> {
    this.templates = await Promise.all(this.templateFiles.map(parseTemplateFile));

    logger.info(`Initializing websocket output adapter on port ${this.port}`);
    this.server = new WebSocket.Server({ port: this.port });
    this.server.on('connection', (ws, req) => {
      logger.info(`New client; Address: ${req.connection.remoteAddress}
User Agent: ${req.headers['user-agent']}`);
      sendAllData(ws, this.currentData);
    });
  }

  public update(state: State): void {
    if (!this.server) {
      throw new Error('Server not initialized');
    }
    this.currentData = this.templates.map(t => t.render(state));
    logger.debug(`Sending update:\n`, this.currentData.join('\n'));
    broadcastAllData(this.server, this.currentData);
  }
}
