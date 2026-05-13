export function nonNull<T>(x: T | null | undefined): x is T {
  return x != null;
}

export function nonEmpty(str?: string | null): str is string {
  return !!str;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

export function isStringRecordEntry(entry: [unknown, unknown]): entry is [string, string] {
  return typeof entry[0] === 'string' && typeof entry[1] === 'string';
}
