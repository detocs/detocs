import {
  closestPrecedingKeyframe,
  closestSubsequentKeyframe,
  closestPrecedingKeyframeFromInterval,
  closestSubsequentKeyframeFromInterval,
} from '@util/keyframes';

describe(closestPrecedingKeyframe, () => {
  it('chooses earlier timestamps', () => {
    expect(closestPrecedingKeyframe(
      [0, 3000, 6000, 9000, 12000],
      '00:00:04.500',
    )).toBe('00:00:03.000');
  });

  it('chooses equal timestamps', () => {
    expect(closestPrecedingKeyframe(
      [0, 3000, 6000, 9000, 12000],
      '00:00:06.000',
    )).toBe('00:00:06.000');
  });

  it('chooses first timestamp if necessary', () => {
    expect(closestPrecedingKeyframe(
      [3000, 6000, 9000, 12000],
      '00:00:01.000',
    )).toBe('00:00:03.000');
  });
});

describe(closestSubsequentKeyframe, () => {
  it('chooses later timestamps', () => {
    expect(closestSubsequentKeyframe(
      [0, 3000, 6000, 9000, 12000],
      '00:00:04.500',
    )).toBe('00:00:06.000');
  });

  it('chooses equal timestamps', () => {
    expect(closestSubsequentKeyframe(
      [0, 3000, 6000, 9000, 12000],
      '00:00:06.000',
    )).toBe('00:00:06.000');
  });

  it('chooses last timestamp if necessary', () => {
    expect(closestSubsequentKeyframe(
      [3000, 6000, 9000, 12000],
      '00:00:13.000',
    )).toBe('00:00:12.000');
  });
});

describe(closestPrecedingKeyframeFromInterval, () => {
  it('chooses earlier timestamps', () => {
    expect(closestPrecedingKeyframeFromInterval(
      3000,
      '00:00:04.500',
    )).toBe('00:00:03.000');
  });

  it('chooses equal timestamps', () => {
    expect(closestPrecedingKeyframeFromInterval(
      3000,
      '00:00:06.000',
    )).toBe('00:00:06.000');
  });

  it('chooses 0s if necessary', () => {
    expect(closestPrecedingKeyframeFromInterval(
      3000,
      '00:00:01.000',
    )).toBe('00:00:00.000');
  });
});

describe(closestSubsequentKeyframeFromInterval, () => {
  it('chooses later timestamps', () => {
    expect(closestSubsequentKeyframeFromInterval(
      3000,
      '00:00:04.500',
    )).toBe('00:00:06.000');
  });

  it('chooses equal timestamps', () => {
    expect(closestSubsequentKeyframeFromInterval(
      3000,
      '00:00:06.000',
    )).toBe('00:00:06.000');
  });
});
