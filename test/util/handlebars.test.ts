import Handlebars from 'handlebars';
import { escapeJson, escapeCsv } from '@util/escaping';
import { setDefaultEscapingFunction } from '@util/handlebars';

describe(setDefaultEscapingFunction, () => {
  it('can escape JSON', () => {
    const hb = Handlebars.create();
    setDefaultEscapingFunction(hb, escapeJson);
    const data = {
      boolean: true,
      number: 610,
      string1: 'has"quote',
      string2: 'has\\backslash',
    };
    const template = hb.compile(`{
      "boolean": {{boolean}},
      "number": {{number}},
      "string1": "{{string1}}",
      "string2": "{{string2}}",
      "unescapedString1": "{{{string1}}}"
    }`);
    const output = template(data);
    expect(output).toBe(`{
      "boolean": true,
      "number": 610,
      "string1": "has\\"quote",
      "string2": "has\\\\backslash",
      "unescapedString1": "has"quote"
    }`);
  });

  it('can escape CSV', () => {
    const hb = Handlebars.create();
    setDefaultEscapingFunction(hb, escapeCsv);
    const data = {
      boolean: true,
      number: 610,
      string1: 'has"quote',
      string2: 'has,comma',
    };
    const template = hb.compile('{{boolean}}, {{number}}, {{string1}}, {{string2}}, {{{string1}}}');
    const output = template(data);
    expect(output).toBe('true, 610, "has""quote", "has,comma", has"quote');
  });

  it('can escape different types with separate instances', () => {
    const json = Handlebars.create();
    setDefaultEscapingFunction(json, escapeJson);
    const csv = Handlebars.create();
    setDefaultEscapingFunction(csv, escapeCsv);
    const data = {
      string1: 'has"quote',
    };
    const jsonOutput = json.compile(`{
      "string1": "{{string1}}"
    }`)(data);
    expect(jsonOutput).toBe(`{
      "string1": "has\\"quote"
    }`);
    const csvOutput = csv.compile('{{string1}}')(data);
    expect(csvOutput).toBe('"has""quote"');
  });
});
