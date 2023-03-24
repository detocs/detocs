import { err, ok, Result } from 'neverthrow';

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
    return error as Error;
  }
  return null;
}

export function mergeJson(orig: string, update: string): Result<string, Error> {
  try {
    const origObj = JSON.parse(orig);
    const updateObj = JSON.parse(update);
    const merged = Object.assign(origObj, updateObj);
    return ok(JSON.stringify(merged, null, 2));
  } catch (error) {
    return err(error as Error);
  }
}
