import { parseFormData } from '@util/parsing';

describe(parseFormData, () => {
  it('parses empty objects', () => {
    expect(parseFormData({}))
      .toStrictEqual({});
  });

  it('parses simple objects', () => {
    expect(parseFormData({
      'a': 'foo',
      'b': 'bar',
      'c': 'baz',
    }))
      .toStrictEqual({
        'a': 'foo',
        'b': 'bar',
        'c': 'baz',
      });
  });

  it('parses nested objects', () => {
    expect(parseFormData({
      'field[a]': 'foo',
      'field[b][c]': 'bar',
      'field[b][d]': 'baz',
    }))
      .toStrictEqual({
        'field': {
          'a': 'foo',
          'b': {
            'c': 'bar',
            'd': 'baz',
          },
        },
      });
  });

  it('parses arrays', () => {
    expect(parseFormData({
      'field[0]': 'foo',
      'field[1]': 'bar',
      'field[2]': 'baz',
    }))
      .toStrictEqual({
        'field': [
          'foo',
          'bar',
          'baz',
        ],
      });
  });

  it('parses arrays of objects', () => {
    expect(parseFormData({
      'field[0][name]': 'foo',
      'field[0][value]': 'voo',
      'field[1][name]': 'bar',
      'field[1][value]': 'var',
      'field[2][name]': 'baz',
      'field[2][value]': 'vaz',
    }))
      .toStrictEqual({
        'field': [
          { 'name': 'foo', 'value': 'voo' },
          { 'name': 'bar', 'value': 'var' },
          { 'name': 'baz', 'value': 'vaz' },
        ],
      });
  });
});