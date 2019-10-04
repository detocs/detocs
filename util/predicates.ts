export function nonNull<T>(x: T | null): x is T {
  return x != null;
}
