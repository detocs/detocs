import { getLogger } from 'log4js';
const logger = getLogger('output/templates');

import { Error as ChainableError } from 'chainable-error';
import frontMatter from 'front-matter';
import { promises as fs } from 'fs';
import Handlebars from 'handlebars';

import { escapeJson, escapeCsv, escapeString } from '../../../util/escaping';
import State, { sampleState } from '../state';
import { watchFile } from '../../../util/fs';

export interface OutputTemplateData {
  state: State;
  userData: unknown;
}
export interface OutputTemplate {
  render: (data: State) => string;
  userData: unknown;
}

const hb = Handlebars.create();
hb.registerHelper({
  'escapeCsv': escapeCsv,
  'escapeJson': escapeJson,
  'escapeString': escapeString,
});

export async function parseTemplateFile(path: string): Promise<OutputTemplate> {
  const templ = new OutputTemplateImpl(path);
  await templ.parseAndWatch();
  return templ;
}

class OutputTemplateImpl implements OutputTemplate {
  public render: (data: State) => string = () => '';
  public userData: unknown;
  private readonly path: string;
  private watcher: { close(): void } = { close: () => {} };

  public constructor(path: string) {
    this.path = path;
  }

  public async parseAndWatch(): Promise<void> {
    await this.parse();
    this.watcher = watchFile(this.path, this.parse);
  }

  public parse: () => Promise<void> = async () => {
    const contents = await loadTemplateFile(this.path);
    Object.assign(this, parseTemplate(contents));
  };
}

function loadTemplateFile(path: string): Promise<string> {
  logger.info(`Loading output template from ${path}`);
  return fs.readFile(path, { encoding: 'utf8' });
}

function parseTemplate(str: string): OutputTemplate {
  const { userData, templateStr } = extractFrontMatter(str);
  const renderTemplate = hb.compile<OutputTemplateData>(templateStr, { noEscape: true });
  const render = (state: State): string => renderTemplate({ state, userData });
  try {
    render(sampleState);
  } catch(e) {
    throw new ChainableError('Template unable to render sample output', e);
  }
  return { render, userData };
}

function extractFrontMatter(str: string): {
  userData: unknown;
  templateStr: string;
} {
  const { attributes, body } = frontMatter(str);
  return {
    userData: attributes,
    templateStr: body,
  };
}
