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

export function escapeDoublePipe(value: unknown): unknown {
  if (!(typeof value === 'string')) {
    return value;
  }
  return value.replace(/\|\|/g, '');
}
