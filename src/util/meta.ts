import packageJson from 'package.json' with { type: 'json' };

export function getVersion(): string {
  return packageJson.version;
}

export function getProductName(): string {
  return packageJson.productName;
}

export function getHomepage(): string {
  return packageJson.homepage;
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
  return isElectron() || isPkg();
}

export function isElectron(): boolean {
  return !!process.versions.electron;
}

export function isPkg(): boolean {
  return !!process.versions.pkg;
}
