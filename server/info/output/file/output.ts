import { getLogger } from 'log4js';
const logger = getLogger('output/websocket');

import { promises as fs } from 'fs';
import { join } from 'path';

import { FileOutputConfig } from '../../../../util/config';
import State, { nullState } from '../../state';
import Output from '../output';
import { OutputTemplate, parseTemplateFile } from '../templates';


export default class FileOutput implements Output {
  private readonly path: string;
  private readonly templateFiles: string[];
  private templates: OutputTemplate[] = [];

  public constructor({ path, templates }: FileOutputConfig) {
    this.path = path;
    this.templateFiles = templates;
  }

  public async init(): Promise<void> {
    this.templates = await Promise.all(this.templateFiles.map(parseTemplateFile));
    await fs.mkdir(this.path, { recursive: true });
    logger.info(`Initializing file output adapter for ${this.path}`);
    this.update(nullState);
  }

  public update(state: State): void {
    const files = this.templates.map(t => ({
      filePath: join(this.path, t.name),
      data: t.render(state),
    }));
    logger.debug(`Sending update:\n`, files);

    for (const f of files) {
      fs.writeFile(f.filePath, f.data);
    }
  }
}
