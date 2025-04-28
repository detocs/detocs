import { getLogger } from '@util/logger';

import ReconnectingWebSocket from 'reconnecting-websocket';
import WebSocket from 'ws';

import { WebSocketClientOutputConfig, OutputTemplateConfig } from '@util/configuration/config';
import { sendAllData } from '@util/websocket';
import State from '@server/info/state';
import Output from '@server/info/output/output';
import { OutputTemplate, parseTemplateFile } from '@server/info/output/templates';
import { Ok } from 'neverthrow';

const logger = getLogger('output/websocket-client');

export default class WebSocketClientOutput implements Output {
  private readonly url: string;
  private readonly templateFiles: OutputTemplateConfig[];
  private templates: OutputTemplate[] = [];
  private client?: ReconnectingWebSocket;
  private currentData: string[] = [];

  public constructor({ templates, url }: WebSocketClientOutputConfig) {
    this.templateFiles = templates;
    this.url = url;
  }

  public async init(initState: State): Promise<void> {
    this.templates = await Promise.all(this.templateFiles.map(parseTemplateFile));

    logger.info(`Initializing WebSocket client output adapter with address ${this.url}`);
    const client = new ReconnectingWebSocket(this.url, [], {
      WebSocket,
    });
    client.addEventListener('open', () => {
      logger.info(`Connection opened to ${this.url}`);
      sendAllData(client, this.currentData);
    });
    this.client = client;
    this.update(initState);
  }

  public update(state: State): void {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    const files = this.templates.map(t => t.render(state));
    files.forEach(data => data.match(
      () => {/* noop */},
      logger.error,
    ));
    this.currentData = files.filter(data => data.isOk())
      .map(data => (data as Ok<string, Error>).value);
    logger.debug(`Sending update:\n`, this.currentData.join('\n'));
    sendAllData(this.client, this.currentData);
  }
}
