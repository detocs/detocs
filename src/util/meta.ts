import { version } from 'package.json';

export function getVersion(): string {
  return version;
}

let appRoot: string | null;
export function getAppRoot(): string {
  if (!appRoot) {
    throw new Error('App root not set');
  }
  return appRoot;
}

export function setAppRoot(path: string): void {
  appRoot = path;
}
