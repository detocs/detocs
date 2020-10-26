import path from 'path';

import { getAppRoot } from './meta';

export function withoutExtension(sourceFile: string): string {
  return path.basename(sourceFile, path.extname(sourceFile));
}

export function handleBuiltin(builtinPath: string, filepath: string): string {
  return filepath.replace(
    /^.*\$builtin[/\\]/,
    path.join(getAppRoot(), '..', builtinPath, '/'),
  );
}
