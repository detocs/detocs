import memoize from 'micro-memoize';
import { Result, ok, err, ResultAsync } from 'neverthrow';

import { Error as ChainableError } from 'chainable-error';
import Handlebars from 'handlebars';
import frontMatter from 'front-matter';
import { promises as fs } from 'fs';
import { basename, extname } from 'path';

import State, { sampleState } from '@server/info/state';
import { OutputTemplateConfig } from '@util/configuration/config';
import { validateCsv } from '@util/csv';
import { escapeJson, escapeCsv, escapeString, EscapeFunction, escapeRegex } from '@util/escaping';
import { watchFile, Watcher } from '@util/fs';
import { setDefaultEscapingFunction } from '@util/handlebars';
import { validateJson } from '@util/json';
import { getLogger } from '@util/logger';
import { handleBuiltin, isBuiltin } from '@util/path';
import { validateXml } from '@util/xml';

import { OutputState, toOutputState } from './output';

type HbEnv = typeof Handlebars;
export interface OutputTemplate {
  name: string;
  render: (data: State) => Result<string, Error>;
  userData: unknown;
}

interface OutputTemplateData {
  state: OutputState;
  timestamp: number;
  timestampMs: number;
  dotNetTicks: string;
  userData: unknown;
}

const logger = getLogger('output/templates');
// https://docs.microsoft.com/en-us/dotnet/api/system.datetime.ticks
const DOT_NET_TICK_OFFSET_MS = -new Date('0001-01-01') - new Date().getTimezoneOffset()*60*1000;
const ESCAPING_FUNCTIONS_BY_EXTENSION: {
  [ext: string]: EscapeFunction | 'default' | undefined,
} = Object.freeze({
  '.xml': 'default',
  '.html': 'default',
  '.xhtml': 'default',
  '.json': escapeJson,
  '.csv': escapeCsv,
});
const VALIDATION_FUNCTIONS_BY_EXTENSION: {
  [ext: string]: ((str: string) => Error | null) | undefined,
} = Object.freeze({
  '.xml': validateXml,
  '.json': validateJson,
  '.csv': validateCsv,
});
const cachedHandlebarsEnv = memoize(
  getEscapedHandlebars,
  { maxSize: (new Set(Object.values(ESCAPING_FUNCTIONS_BY_EXTENSION))).size },
);

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
  if (isBuiltin(template)) {
    await templ.parse();
  } else {
    await templ.parseAndWatch();
  }
  return templ;
}

class OutputTemplateImpl implements OutputTemplate {
  public render: (data: State) => Result<string, Error> = () => ok('');
  public userData: unknown;
  public readonly name: string;
  private readonly path: string;
  private watcher: Watcher = { close: () => {/* ignore */} };

  public constructor(path: string, name: string) {
    this.path = path;
    this.name = name;
  }

  public async parseAndWatch(): Promise<void> {
    this.watcher = watchFile(this.path, this.parse, err => { throw err; });
    await this.parse();
  }

  public parse: () => Promise<void> = () => {
    return loadTemplateFile(this.path)
      .andThen(contents => parseTemplate(contents, this.name))
      .match(
        templ => {
          this.render = templ.render;
          this.userData = templ.userData;
        },
        logger.error,
      );
  };
}

function loadTemplateFile(path: string): ResultAsync<string, Error> {
  logger.info(`Loading output template from ${path}`);
  return ResultAsync.fromPromise<string, Error>(
    fs.readFile(path, { encoding: 'utf8' }),
    e => e as Error);
}

function parseTemplate(contents: string, name: string): Result<OutputTemplate, Error> {
  const { userData, templateStr } = extractFrontMatter(contents);
  const fileExtension = extname(name);
  const { hb, compileOptions } = cachedHandlebarsEnv(
    ESCAPING_FUNCTIONS_BY_EXTENSION[fileExtension],
  );
  const renderTemplate = hb.compile<OutputTemplateData>(
    templateStr,
    compileOptions,
  );
  const render: OutputTemplate['render'] = state => {
    const templateData: OutputTemplateData = {
      state: toOutputState(state),
      ...getTimestamps(),
      userData,
    };
    try {
      return ok(renderTemplate(templateData));
    } catch (error) {
      return err(error as Error);
    }
  };
  return render(sampleState)
    .mapErr(e =>
      new ChainableError(`Template ${name} was unable to render sample output`, e))
    .andThen(sampleOutput => {
      const validator = VALIDATION_FUNCTIONS_BY_EXTENSION[fileExtension];
      const error = validator && validator(sampleOutput);
      if (error) {
        return err(new ChainableError(
          `Sample output for ${name} fails validation:\n${sampleOutput}`,
          error,
        ));
      }
      return ok({ render, userData, name });
    });
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

function getTimestamps(): { timestamp: number, timestampMs: number, dotNetTicks: string} {
  const now = Date.now();
  const ticksMs = DOT_NET_TICK_OFFSET_MS + now;
  return {
    timestamp: Math.floor(now / 1000),
    timestampMs: now,
    dotNetTicks: ticksMs + '0000',
  };
}

function getEscapedHandlebars(
  escaper: EscapeFunction | 'default' | undefined,
): {hb: HbEnv, compileOptions: CompileOptions } {
  const hb = Handlebars.create();
  hb.registerHelper({
    'escapeString': escapeString,
    'escapeRegex': escapeRegex,
  });
  if (!escaper) {
    return {
      hb,
      compileOptions: { noEscape: true },
    };
  } else if (escaper === 'default') {
    return {
      hb,
      compileOptions: { noEscape: false },
    };
  } else {
    setDefaultEscapingFunction(hb, escaper);
    return {
      hb,
      compileOptions: { noEscape: false },
    };
  }
}
