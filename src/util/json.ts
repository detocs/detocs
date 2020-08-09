// eslint-disable-next-line @typescript-eslint/ban-types
export function sortedKeys(obj: Object): string[] {
  const allKeys: string[] = [];
  JSON.stringify(obj, (key, value) => { allKeys.push(key); return value; });
  allKeys.sort();
  return allKeys;
}
