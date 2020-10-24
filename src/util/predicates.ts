export function nonNull<T>(x: T | null | undefined): x is T {
  return x != null;
}

export function nonEmpty(str?: string | null): str is string {
  return !!str;
}
