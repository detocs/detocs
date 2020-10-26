import { getLogger } from '@util/logger';

import { Error as ChainableError } from 'chainable-error';
import frontMatter from 'front-matter';
import { promises as fs } from 'fs';
import Handlebars from 'handlebars';
import { basename } from 'path';

import State, { sampleState } from '@server/info/state';
import { escapeJson, escapeCsv, escapeString } from '@util/escaping';
import { watchFile, Watcher } from '@util/fs';
import { handleBuiltin } from '@util/path';

import { OutputState, toOutputState } from './output';
import { OutputTemplateConfig } from '@util/configuration/config';
import { template } from '@babel/core';

export interface OutputTemplate {
  name: string;
  render: (data: State) => string;
  userData: unknown;
}

interface OutputTemplateData {
  state: OutputState;
  timestamp: number;
  userData: unknown;
}

const logger = getLogger('output/templates');
const hb = Handlebars.create();
hb.registerHelper({
  'escapeCsv': escapeCsv,
  'escapeJson': escapeJson,
  'escapeString': escapeString,
});

export async function parseTemplateFile(
  templateConfig: OutputTemplateConfig,
): Promise<OutputTemplate> {
  const template = typeof templateConfig === 'string'
    ? templateConfig
    : templateConfig.template;
  const outputName = typeof templateConfig === 'string'
    ? basename(templateConfig).replace(/(\.hbs|\.handlebars)$/, '')
    : templateConfig.outputName;
  const templ = new OutputTemplateImpl(
    handleBuiltin('templates/output', template),
    outputName,
  );
  await templ.parseAndWatch();
  return templ;
}

class OutputTemplateImpl implements OutputTemplate {
  public render = (): string => '';
  public userData: unknown;
  public  readonly name: string;
  private readonly path: string;
  private watcher: Watcher = { close: () => {/* ignore */} };

  public constructor(path: string, name: string) {
    this.path = path;
    this.name = name;
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
  const isXml = name.endsWith('.xml') || name.endsWith('.html');
  const renderTemplate = hb.compile<OutputTemplateData>(
    templateStr,
    { noEscape: !isXml },
  );
  const render: OutputTemplate['render'] = state => {
    const templateData: OutputTemplateData = {
      state: toOutputState(state),
      timestamp: getTimestamp(),
      userData,
    };
    return renderTemplate(templateData);
  };
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
