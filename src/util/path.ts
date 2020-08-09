import path from 'path';

export function withoutExtension(sourceFile: string): string {
  return path.basename(sourceFile, path.extname(sourceFile));
}
