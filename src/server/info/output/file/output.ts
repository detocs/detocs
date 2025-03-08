import { promises as fs } from 'fs';
import { extname, join } from 'path';

import { ok, okAsync, Result, ResultAsync } from 'neverthrow';

import State from '@server/info/state';
import Output from '@server/info/output/output';
import { OutputTemplate, parseTemplateFile } from '@server/info/output/templates';
import { FileOutputConfig, OutputTemplateConfig } from '@util/configuration/config';
import { readFile, watchFile, writeFile } from '@util/fs';
import { mergeJson } from '@util/json';
import { getLogger } from '@util/logger';

const logger = getLogger('output/file');

const MERGE_FUNCTIONS_BY_EXTENSION: {
  [ext: string]: ((orig: string, update: string) => Result<string, Error>) | undefined,
} = Object.freeze({
  '.json': mergeJson,
});

interface OutputData {
  rawData: string;
  writtenData: string;
}

export default class FileOutput implements Output {
  private readonly path: string;
  private readonly templateFiles: OutputTemplateConfig[];
  private templates: OutputTemplate[] = [];
  private latestDataByPath: Map<string, OutputData> = new Map();

  public constructor({ path, templates }: FileOutputConfig) {
    this.path = path;
    this.templateFiles = templates;
  }

  public async init(initState: State): Promise<void> {
    this.templates = await Promise.all(this.templateFiles.map(parseTemplateFile));
    await fs.mkdir(this.path, { recursive: true });
    logger.info(`Initializing file output adapter for ${this.path}`);
    this.update(initState);
    for (const template of this.templates) {
      const path = this.getTemplatePath(template);
      const mergeFn = MERGE_FUNCTIONS_BY_EXTENSION[extname(template.name)];
      if (!mergeFn) {
        continue;
      }
      logger.debug(`Watching file ${path} in order to merge with outside changes`);
      watchFile(
        path,
        () => {
          readFile(path)
            .andThen(updatedContent => {
              const lastData = this.latestDataByPath.get(path);
              if (lastData == null || updatedContent === lastData.writtenData) {
                return okAsync(void 0);
              }
              logger.info(`Output file ${path} updated by external program, merging data`);
              return mergeFn(updatedContent, lastData.rawData)
                .asyncAndThen(content => this.writeData(path, {
                  rawData: lastData.rawData,
                  writtenData: content,
                }));
            })
            .mapErr(logger.error);
        },
        logger.error,
      );
    }
  }

  public update(state: State): void {
    this.render(state, this.templates);
  }

  private render(state: State, templates: OutputTemplate[]): void {
    const files = templates.map(t => ({
      filePath: this.getTemplatePath(t),
      data: t.render(state),
      mergeFn: MERGE_FUNCTIONS_BY_EXTENSION[extname(t.name)]
    }));

    files.forEach(({ filePath, data, mergeFn }) => data
      .asyncAndThen(rawData => {
        if (!mergeFn) {
          return okAsync({ rawData, writtenData: rawData });
        }
        return readFile(filePath)
          .orElse<Error>(() => { logger.debug(`Unable to read ${filePath}`); return ok(''); })
          .andThen(currContent => currContent.trim() ? mergeFn(currContent, rawData) : ok(rawData))
          .map(mergedData => ({ rawData, writtenData: mergedData }));
      })
      .andThen(data => this.writeData(filePath, data))
      .mapErr(logger.error)
    );
  }

  private writeData(filePath: string, data: OutputData): ResultAsync<void, Error> {
    logger.debug(`Writing update to ${filePath}:\n${data.writtenData}`);
    this.latestDataByPath.set(filePath, data);
    return writeFile(filePath, data.writtenData);
  }

  private getTemplatePath(t: OutputTemplate): string {
    return join(this.path, t.name);
  }
}
