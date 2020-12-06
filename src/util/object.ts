import { nonNull } from './predicates';

export function filterValues<T>(
  obj: T | null | undefined,
  predicate: (value: T[keyof T]) => boolean,
): Partial<T> {
  const entries = obj ? Object.entries(obj) : [];
  return Object.fromEntries(entries.filter(([ , value ]) => predicate(value))) as Partial<T>;
}

export function filterNullValues<T>(
  obj: T | null | undefined,
): Pick<T, RequiredKeys<T>> & Partial<T> {
  return filterValues(obj, nonNull) as Pick<T, RequiredKeys<T>> & Partial<T>;
}

type RequiredKeys<T> = {
  // eslint-disable-next-line @typescript-eslint/ban-types
  [K in keyof T]: ({} extends { [P in K]: T[K] } ? never : K)
}[keyof T];
