import sortedIndex from 'lodash.sortedindex';

import { Timestamp } from '@models/timestamp';

import { toMillis, fromMillis } from './timestamp';

export function closestPrecedingKeyframe(keyframes: number[], timestamp: Timestamp): Timestamp {
  const millis = toMillis(timestamp);
  const index = sortedIndex(keyframes, millis);
  if (keyframes[index] === millis) {
    return fromMillis(keyframes[index]);
  }
  return fromMillis(keyframes[Math.max(0, index - 1)]);
}

export function closestSubsequentKeyframe(keyframes: number[], timestamp: Timestamp): Timestamp {
  const index = sortedIndex(keyframes, toMillis(timestamp));
  return fromMillis(keyframes[Math.min(keyframes.length - 1, index)]);
}

export function closestPrecedingKeyframeFromInterval(
  intervalMillis: number,
  timestamp: Timestamp,
): Timestamp {
  let millis = toMillis(timestamp);
  millis = millis - millis % intervalMillis;
  return fromMillis(millis);
}

export function closestSubsequentKeyframeFromInterval(
  intervalMillis: number,
  timestamp: Timestamp,
): Timestamp {
  let millis = toMillis(timestamp);
  const remainder = millis % intervalMillis;
  if (remainder === 0) {
    return fromMillis(millis);
  }
  millis = millis + intervalMillis - remainder;
  return fromMillis(millis);
}
