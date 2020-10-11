export function filterValues<T>(
  obj: T | null | undefined,
  predicate: (value: T[keyof T]) => boolean,
): Partial<T> {
  const entries = obj ? Object.entries(obj) : [];
  return Object.fromEntries(entries.filter(([ , value ]) => predicate(value))) as Partial<T>;
}
