import escapeRegExp from 'lodash.escaperegexp';

export function escapeString(value: unknown, escape: string, escapeWith: string): unknown {
  if (!(typeof value === 'string')) {
    return value;
  }
  return value.replace(new RegExp(escapeRegExp(escape), 'g'), escapeWith);
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
  // TODO: implement
  return value;
}

export function escapeDoublePipe(value: unknown): unknown {
  return escapeString(value, '||', '|');
}
