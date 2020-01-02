import chokidar, { FSWatcher } from 'chokidar';

export function watchFile(path: string, onChange: () => void): FSWatcher {
  return chokidar.watch(path, { persistent: false })
    .on('change', onChange);
}
