import parse from 'csv-parse/lib/sync';

export function validateCsv(str: string): Error | null {
  try {
    parse(str);
  } catch (error) {
    return error;
  }
  return null;
}
