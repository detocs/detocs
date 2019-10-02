import moment from 'moment';

const TIMESTAMP_FORMAT = 'HH:mm:ss.SSS';

export function validateTimestamp(timestamp: string): boolean {
  return moment(timestamp, TIMESTAMP_FORMAT).isValid();
}

export function offsetTimestamp(timestamp: string, offsetSeconds: number): string {
  const time = moment(timestamp, TIMESTAMP_FORMAT);
  time.add(offsetSeconds, 'seconds');
  return time.format(TIMESTAMP_FORMAT);
}

export function truncateTimestamp(timestamp: string): string {
  const time = moment(timestamp, TIMESTAMP_FORMAT);
  time.millisecond(0);
  return time.format(TIMESTAMP_FORMAT);
}

export function subtractTimestamp(a: string, b: string): string {
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

export function sanitizeTimestamp(timestamp: string): string {
  return timestamp.replace(/:/g, '-');
}
