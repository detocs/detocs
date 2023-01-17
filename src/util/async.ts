import { ResultAsync } from 'neverthrow';
import pLimit = require('p-limit');
import { performance } from 'perf_hooks';

import { getLogger } from '@util/logger';

const logger = getLogger('util/async');

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

export function toPromise<T>(res: ResultAsync<T, Error>): Promise<T> {
  return res.match(
    v => v,
    e => { throw e; },
  );
}

export async function waitUntil(
  condition: () => Promise<boolean>,
  maxTimeMs: number,
  intervalMs = 250,
): Promise<void> {
  const startTime = performance.now();
  while (performance.now() - startTime < maxTimeMs) {
    if (await condition()) {
      logger.debug(`wait duration: ${performance.now() - startTime}ms`);
      return;
    }
    await sleep(intervalMs);
  }
}
