import moment from 'moment';

export function offsetTimestamp(timestamp: string, offsetSeconds: number): string {
  const TIMESTAMP_FORMAT = 'HH:mm:ss.SSS';
  const time = moment(timestamp, TIMESTAMP_FORMAT);
  time.add(offsetSeconds, 'seconds');
  return time.format(TIMESTAMP_FORMAT);
}

export function truncateTimestamp(timestamp: string): string {
  const TIMESTAMP_FORMAT = 'HH:mm:ss.SSS';
  const time = moment(timestamp, TIMESTAMP_FORMAT);
  time.millisecond(0);
  return time.format(TIMESTAMP_FORMAT);
}

export function sanitizeTimestamp(timestamp: string): string {
  return timestamp.replace(/:/g, '-');
}
