import { version, productName, homepage } from 'package.json';

export function getVersion(): string {
  return version;
}

export function getProductName(): string {
  return productName;
}

export function getHomepage(): string {
  return homepage;
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

export function isPackagedApp(): boolean {
  return isElectron();
}

function isElectron(): boolean {
  return !!process.versions.electron;
}
