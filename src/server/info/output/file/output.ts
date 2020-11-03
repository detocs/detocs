import { getLogger } from '@util/logger';

import { promises as fs } from 'fs';
import { join } from 'path';

import { FileOutputConfig, OutputTemplateConfig } from '@util/configuration/config';
import State, { nullState } from '@server/info/state';
import Output from '@server/info/output/output';
import { OutputTemplate, parseTemplateFile } from '@server/info/output/templates';

const logger = getLogger('output/file');

export default class FileOutput implements Output {
  private readonly path: string;
  private readonly templateFiles: OutputTemplateConfig[];
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

    files.forEach(f => f.data.match(
      str => {
        logger.debug(`Writing update to ${f.filePath}:\n${str}`);
        fs.writeFile(f.filePath, str);
      },
      logger.error,
    ));
  }
}
