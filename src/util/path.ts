import path from 'path';

import { getAppRoot } from './meta';

const BUILTIN_REGEX = /^.*\$builtin[/\\]/;

export function withoutExtension(sourceFile: string): string {
  return path.basename(sourceFile, path.extname(sourceFile));
}

export function isBuiltin(path: string): boolean {
  return BUILTIN_REGEX.test(path);
}

export function handleBuiltin(builtinPath: string, filepath: string): string {
  return filepath.replace(
    BUILTIN_REGEX,
    path.join(getAppRoot(), '..', builtinPath, '/'),
  );
}
