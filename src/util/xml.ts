import parser from 'fast-xml-parser';

export function validateXml(str: string): Error | null {
  const potentialError = parser.validate(str);
  if (potentialError !== true) {
    return new Error(`${potentialError.err.code}
Line ${potentialError.err.line}: ${potentialError.err.msg}`);
  }
  return null;
}
