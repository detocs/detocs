import chokidar from 'chokidar';
import { tmpdir } from 'os';
import { join } from 'path';

const TMP_DIR_NAME = 'detocs';

export interface Watcher {
  close(): void;
}

export function watchFile(
  path: string,
  onChange: () => void,
  onError: (err: Error) => void,
): Watcher {
  return chokidar.watch(path, { persistent: false })
    .on('error', onError)
    .on('change', onChange);
}

export function waitForFile(
  path: string,
  onAdd: (path: string) => void,
  onError: () => void,
): Watcher {
  return chokidar.watch(
    path,
    {
      depth: 0,
      persistent: false,
      ignoreInitial: true,
      ignorePermissionErrors: true,
      useFsEvents: false,
    })
    .on('error', onError)
    .on('add', onAdd);
}

export function tmpDir(name: string): string {
  return join(tmpdir(), TMP_DIR_NAME, name);
}
