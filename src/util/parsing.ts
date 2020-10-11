import set from 'lodash.set';

export function parseFormData(fields: Record<string, unknown>): Record<string, unknown> {
  const ret = {};
  for (const path in fields) {
    const keys = path.split(/[\[\]]+/).filter(key => !!key).map(parseKey);
    set(ret, keys, fields[path]);
  }
  return ret;
}

function parseKey(key: string): string | number {
  const num = parseInt(key, 10);
  if (num.toString() === key && num >= 0) {
    return num;
  }
  return key;
}
