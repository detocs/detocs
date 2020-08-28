import { toMillis, fromMillis, truncateTimestamp, sanitizeTimestamp, validateTimestamp, offsetTimestamp, subtractTimestamp } from '@util/timestamp';

describe(toMillis, () => {
  it('handles hours/minutes/seconds/milliseconds', () => {
    expect(toMillis('12:34:56.789')).toBe(45296789);
  });

  it('handles hours/minutes/seconds', () => {
    expect(toMillis('12:34:56')).toBe(45296000);
  });

  it('handles minutes/seconds', () => {
    expect(toMillis('34:56')).toBe(2096000);
  });

  it('handles seconds only', () => {
    expect(toMillis('56')).toBe(56000);
  });

  it('handles seconds beyond 60', () => {
    expect(toMillis('456')).toBe(456000);
  });

  it('handles milliseconds only', () => {
    expect(toMillis('.789')).toBe(789);
  });

  it('handles decimal with no milliseconds', () => {
    expect(toMillis('12:34:56.')).toBe(45296000);
  });

  it.skip('handles non-triple-digit milliseconds', () => {
    expect(toMillis('.7')).toBe(700);
    expect(toMillis('.78')).toBe(780);
    expect(toMillis('.7890')).toBe(789);
  });

  it('handles zero', () => {
    expect(toMillis('00:00:00')).toBe(0);
  });

  it.skip('handles negative timestamps', () => {
    expect(toMillis('-12:34:56.789')).toBe(-45296789);
  });

  it.skip('ignores fractional milliseconds', () => {
    expect(toMillis('.7895')).toBe(789);
  });
});

describe(fromMillis, () => {
  it('handles hours/minutes/seconds/milliseconds', () => {
    expect(fromMillis(45296789)).toBe('12:34:56.789');
  });

  it('handles hours/minutes/seconds', () => {
    expect(fromMillis(45296000)).toBe('12:34:56.000');
  });

  it('handles minutes/seconds', () => {
    expect(fromMillis(2096000)).toBe('00:34:56.000');
  });

  it('handles seconds only', () => {
    expect(fromMillis(56000)).toBe('00:00:56.000');
  });

  it('handles milliseconds only', () => {
    expect(fromMillis(789)).toBe('00:00:00.789');
  });

  it('handles zero', () => {
    expect(fromMillis(0)).toBe('00:00:00.000');
  });

  it.skip('handles negative timestamps', () => {
    expect(fromMillis(-45296789)).toBe('-12:34:56.789');
  });

  it.skip('ignores fractional milliseconds', () => {
    expect(fromMillis(789.5)).toBe('00:00:00.789');
  });
});

describe(validateTimestamp, () => {
  it('considers full timestamp valid', () => {
    expect(validateTimestamp('12:34:56.789')).toBe(true);
  });

  it('considers hh:mm:ss valid', () => {
    expect(validateTimestamp('12:34:56')).toBe(true);
  });

  it.skip('considers mm:ss valid', () => {
    expect(validateTimestamp('34:56')).toBe(false);
  });

  it.skip('considers ss valid', () => {
    expect(validateTimestamp('56')).toBe(false);
  });

  it.skip('considers minute/second components with more than 2 digits invalid', () => {
    expect(validateTimestamp('12:34:556.789')).toBe(false);
    expect(validateTimestamp('12:334:56.789')).toBe(false);
  });

  it('considers minute/second components greater than 59 invalid', () => {
    expect(validateTimestamp('12:34:63.789')).toBe(false);
    expect(validateTimestamp('12:74:56.789')).toBe(false);
  });

  it.skip('considers too many components invalid', () => {
    expect(validateTimestamp('12:34:56:78.900')).toBe(false);
  });

  it.skip('requires colons', () => {
    expect(validateTimestamp('12-34-56.789')).toBe(false);
  });
});

describe(offsetTimestamp, () => {
  it('handles positive offests', () => {
    expect(offsetTimestamp('12:34:56.789', 3)).toBe('12:34:59.789');
  });

  it('handles negative offsets', () => {
    expect(offsetTimestamp('12:34:56.789', -3)).toBe('12:34:53.789');
  });

  it.skip('handles negative timestamps', () => {
    expect(offsetTimestamp('-12:34:56.789', 3)).toBe('-12:34:53.789');
  });

  it.skip('can subtract beyond zero', () => {
    expect(offsetTimestamp('00:00:05.000', -10)).toBe('-00:00:05.000');
  });
});

describe(truncateTimestamp, () => {
  it('handles hours/minutes/seconds/milliseconds', () => {
    expect(truncateTimestamp('12:34:56.789')).toBe('12:34:56.000');
  });

  it.skip('handles negative timestamps', () => {
    expect(truncateTimestamp('-12:34:56.789')).toBe('-12:34:56.000');
  });
});

describe(subtractTimestamp, () => {
  it('handles a == b', () => {
    expect(subtractTimestamp('12:34:56.789', '12:34:56.789')).toBe('00:00:00.000');
  });

  it('handles a > b', () => {
    expect(subtractTimestamp('12:34:56.789', '11:11:11.111')).toBe('01:23:45.678');
  });

  it('handles a < b', () => {
    expect(subtractTimestamp('01:34:56.789', '12:34:56.789')).toBe('-11:00:00.000');
  });

  it.skip('handles negative timestamps', () => {
    expect(subtractTimestamp('-01:00:56.000', '11:34:00.789')).toBe('-12:34:56:789');
  });
});

describe(sanitizeTimestamp, () => {
  it('removes colons', () => {
    expect(sanitizeTimestamp('12:34:56.789')).toBe('12-34-56.789');
  });
});
