export function capitalize(str: string): string {
  return str && `${str[0].toUpperCase()}${str.substring(1)}`;
}
