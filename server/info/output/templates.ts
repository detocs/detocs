import { getLogger } from 'log4js';
const logger = getLogger('output/templates');

import { Error as ChainableError } from 'chainable-error';
import frontMatter from 'front-matter';
import { promises as fs } from 'fs';
import Handlebars from 'handlebars';
import { basename } from 'path';

import { escapeJson, escapeCsv, escapeString } from '@util/escaping';
import { watchFile, Watcher } from '@util/fs';

import State, { sampleState } from '@server/info/state';

export interface OutputTemplate {
  name: string;
  render: (data: State) => string;
  userData: unknown;
}

interface OutputTemplateData {
  state: State;
  timestamp: number;
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
  public  readonly name: string;
  private readonly path: string;
  private watcher: Watcher = { close: () => {} };

  public constructor(path: string) {
    this.path = path;
    this.name = basename(this.path).replace(/(\.hbs|\.handlebars)$/, '');
  }

  public async parseAndWatch(): Promise<void> {
    this.watcher = watchFile(this.path, this.parse);
    await this.parse();
  }

  public parse: () => Promise<void> = async () => {
    const contents = await loadTemplateFile(this.path);
    Object.assign(this, parseTemplate(contents, this.name));
  };
}

function loadTemplateFile(path: string): Promise<string> {
  logger.info(`Loading output template from ${path}`);
  return fs.readFile(path, { encoding: 'utf8' });
}

function parseTemplate(contents: string, name: string): OutputTemplate | null {
  const { userData, templateStr } = extractFrontMatter(contents);
  const renderTemplate = hb.compile<OutputTemplateData>(templateStr, { noEscape: true });
  const render = (state: State): string => renderTemplate({
    state,
    timestamp: getTimestamp(),
    userData,
  });
  try {
    render(sampleState);
  } catch(e) {
    logger.error(new ChainableError('Template unable to render sample output', e));
    return null;
  }
  return { render, userData, name };
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

function getTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}
