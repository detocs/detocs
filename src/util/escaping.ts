import escapeRegExp from 'lodash.escaperegexp';

export type EscapeFunction = (value: unknown) => unknown;

export function escapeString(value: unknown, escape: string, escapeWith: string): unknown {
  if (!(typeof value === 'string')) {
    return value;
  }
  return value.replace(new RegExp(escapeRegExp(escape), 'g'), escapeWith);
}

export function escapeRegex(value: unknown, escape: string, escapeWith: string): unknown {
  if (!(typeof value === 'string')) {
    return value;
  }
  return value.replace(new RegExp(escape, 'g'), escapeWith);
}

export function escapeCsv(value: unknown): unknown {
  if (!(typeof value === 'string')) {
    return value;
  }
  const mustQuote = /[,"\r\n]/.test(value);
  if (!mustQuote) {
    return value;
  }
  return `"${value.replace(/"/g, '""')}"`;
}

export function escapeJson(value: unknown): unknown {
  if (!(typeof value === 'string')) {
    return value;
  }
  return JSON.stringify(value).slice(1, -1);
}

export function escapeDoublePipe(value: unknown): unknown {
  return escapeString(value, '||', '|');
}
