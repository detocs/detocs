import { parseKeyframes } from '@util/ffmpeg';

describe(parseKeyframes, () => {
  it('pads ms correctly', () => {
    const stdout = `0:00:00.1
2:00:03.12
4:00:06.123`;
    expect(parseKeyframes(stdout)).toStrictEqual([
      '0:00:00.100',
      '2:00:03.120',
      '4:00:06.123',
    ]);
  });

  it('truncates ms correctly', () => {
    const stdout = `4:00:06.123
6:00:09.1234
8:00:12.12345
10:00:15.123456
12:00:18.1234567`;
    expect(parseKeyframes(stdout)).toStrictEqual([
      '4:00:06.123',
      '6:00:09.123',
      '8:00:12.123',
      '10:00:15.123',
      '12:00:18.123',
    ]);
  });

  it('trims whitespace', () => {
    const stdout = `\n\t 0:00:00.000000\t \n`;
    expect(parseKeyframes(stdout)).toStrictEqual([
      '0:00:00.000',
    ]);
  });
});
