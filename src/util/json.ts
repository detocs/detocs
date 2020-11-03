// eslint-disable-next-line @typescript-eslint/ban-types
export function sortedKeys(obj: Object): string[] {
  const allKeys: string[] = [];
  JSON.stringify(obj, (key, value) => { allKeys.push(key); return value; });
  allKeys.sort();
  return allKeys;
}

export function validateJson(str: string): Error | null {
  try {
    JSON.parse(str);
  } catch (error) {
    return error;
  }
  return null;
}
