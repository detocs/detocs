export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function delay<T>(ms: number): (value: T) => Promise<T> {
  return value => sleep(ms).then(() => value);
}
