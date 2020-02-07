// TODO: Remove momentjs dependency
import moment from 'moment';

import { Timestamp } from '../models/timestamp';

const TIMESTAMP_FORMAT = 'HH:mm:ss.SSS';

export function toMillis(timestamp: Timestamp): number {
  const millisSplit = timestamp.split('.');
  const millis = millisSplit.length > 1 ? +millisSplit[1] : 0;
  const withoutMillis = millisSplit[0];
  let [ secondsStr, minutesStr, hoursStr ] = withoutMillis.split(':').reverse();
  const seconds = secondsStr ? +secondsStr : 0;
  const minutes = minutesStr ? +minutesStr : 0;
  const hours = hoursStr ? +hoursStr : 0;
  return millis +
    seconds * 1000 +
    minutes * 1000 * 60 +
    hours * 1000 * 60 * 60;
}

export function fromMillis(milliseconds: number): Timestamp {
  const ml = milliseconds % 1000;
  const seconds = Math.floor(milliseconds / 1000);
  const s = seconds % 60;
  const minutes = Math.floor(seconds / 60);
  const m = minutes % 60;
  const h = Math.floor(minutes / 60);
  const pad = (n: number): string => n.toString().padStart(2, '0');
  const padMillis = (n: number): string => n.toString().padStart(3, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}.${padMillis(ml)}`;
}

export function validateTimestamp(timestamp: Timestamp): boolean {
  return moment(timestamp, TIMESTAMP_FORMAT).isValid();
}

export function offsetTimestamp(timestamp: Timestamp, offsetSeconds: number): Timestamp {
  const time = moment(timestamp, TIMESTAMP_FORMAT);
  time.add(offsetSeconds, 'seconds');
  return time.format(TIMESTAMP_FORMAT);
}

export function truncateTimestamp(timestamp: Timestamp): Timestamp {
  const time = moment(timestamp, TIMESTAMP_FORMAT);
  time.millisecond(0);
  return time.format(TIMESTAMP_FORMAT);
}

export function subtractTimestamp(a: Timestamp, b: Timestamp): Timestamp {
  const timeA = moment(a, TIMESTAMP_FORMAT);
  const timeB = moment(b, TIMESTAMP_FORMAT);
  if (timeA.isBefore(timeB)) {
    return '-' + moment.utc(timeB.diff(timeA))
      .format(TIMESTAMP_FORMAT);
  } else {
    return '-' + moment.utc(timeA.diff(timeB))
      .format(TIMESTAMP_FORMAT);
  }
}

export function sanitizeTimestamp(timestamp: Timestamp): Timestamp {
  return timestamp.replace(/:/g, '-');
}
