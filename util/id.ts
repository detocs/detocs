/**
 * ID designed to be:
 * - Monotonic (ish)
 * - Usable as an HTML ID (start with a letter)
 * - Be readable as a date/time
 */
export type Id = string;

const COUNTER_RADIX = 36;
const COUNTER_LENGTH = 4;
const MAX_COUNTER = COUNTER_RADIX ** COUNTER_LENGTH;
let lastTimestamp: string | undefined;
let counter = 0;

export function getId(): string {
  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '');
  if (timestamp === lastTimestamp) {
    counter++;
  } else {
    lastTimestamp = timestamp;
    counter = 0;
  }
  const counterStr = (counter % MAX_COUNTER)
    .toString(COUNTER_RADIX)
    .padStart(COUNTER_LENGTH, '0');
  return 'd' + timestamp + counterStr;
}
