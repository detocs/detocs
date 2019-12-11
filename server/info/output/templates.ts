import { Error as ChainableError } from 'chainable-error';
import frontMatter from 'front-matter';
import Handlebars from 'handlebars';

import { escapeJson, escapeCsv, escapeString } from '../../../util/escaping';
import State, { sampleState } from '../state';

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

export function parseTemplate(str: string): OutputTemplate {
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
