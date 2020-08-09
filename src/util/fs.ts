import chokidar from 'chokidar';
import { tmpdir } from 'os';
import { join } from 'path';

const TMP_DIR_NAME = 'detocs';

export interface Watcher {
  close(): void;
}

export function watchFile(path: string, onChange: () => void): Watcher {
  return chokidar.watch(path, { persistent: false })
    .on('change', onChange);
}

export function waitForFile(path: string, onAdd: (path: string) => void): Watcher {
  return chokidar.watch(path, { persistent: false, ignoreInitial: true })
    .on('add', onAdd);
}

export function tmpDir(name: string): string {
  return join(tmpdir(), TMP_DIR_NAME, name);
}
