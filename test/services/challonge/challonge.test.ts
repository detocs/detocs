import { parseEntrantName } from '@services/challonge/challonge';

describe(parseEntrantName, () => {
  it('leaves regular names alone', () => {
    expect(parseEntrantName('asdf')).toEqual({
      prefix: null,
      handle: 'asdf',
    });
  });

  it('parses single prefixes', () => {
    expect(parseEntrantName('qw | asdf')).toEqual({
      prefix: 'qw',
      handle: 'asdf',
    });
  });

  it('parses multiple prefixes', () => {
    expect(parseEntrantName('zx | qw | asdf')).toEqual({
      prefix: 'zx | qw',
      handle: 'asdf',
    });
  });

  it('handles multiple pipes', () => {
    expect(parseEntrantName('qw || asdf')).toEqual({
      prefix: 'qw',
      handle: 'asdf',
    });
    expect(parseEntrantName('qw ||| asdf')).toEqual({
      prefix: 'qw',
      handle: 'asdf',
    });
  });

  it('handles varying whitespace around pipe', () => {
    expect(parseEntrantName('qw|asdf')).toEqual({
      prefix: 'qw',
      handle: 'asdf',
    });
    expect(parseEntrantName('qw  |  asdf')).toEqual({
      prefix: 'qw',
      handle: 'asdf',
    });
  });

  it('handles empty string', () => {
    expect(parseEntrantName('')).toEqual({
      prefix: null,
      handle: '',
    });
  });
});
