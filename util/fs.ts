import chokidar, { FSWatcher } from 'chokidar';
import { tmpdir } from 'os';
import { join } from 'path';

const TMP_DIR_NAME = 'detocs';

export function watchFile(path: string, onChange: () => void): FSWatcher {
  return chokidar.watch(path, { persistent: false })
    .on('change', onChange);
}

export function tmpDir(name: string): string {
  return join(tmpdir(), TMP_DIR_NAME, name);
}
