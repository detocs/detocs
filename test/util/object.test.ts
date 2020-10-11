import { filterValues } from '@util/object';

describe(filterValues, () => {
  it('can remove falsy values', () => {
    expect(filterValues({ a: 'a', b: '', c: null, d: undefined }, val => !!val))
      .toStrictEqual({ a: 'a' });
  });
});