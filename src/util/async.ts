import { ResultAsync } from 'neverthrow';
import pLimit = require('p-limit');

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function delay<T>(ms: number): (value: T) => Promise<T> {
  return value => sleep(ms).then(() => value);
}

export function rLimit(concurrency: number): <T, E>(task: ResultAsync<T, E>) => ResultAsync<T, E> {
  const queue = pLimit(concurrency);
  return <T, E>(task: ResultAsync<T, E>) => ResultAsync.fromPromise(queue(() => task.match(
    t => t,
    e => { throw e; },
  )), e => e as E);
}
