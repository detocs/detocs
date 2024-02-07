export function capitalize(str: string): string {
  return str && `${str[0].toUpperCase()}${str.substring(1)}`;
}

export function compareStr(a: string, b: string): number {
  return a === b ? 0 : (a < b ? -1 : 1);
}
