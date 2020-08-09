import { promises as fs } from "fs";
import { dirname, join } from "path";

export interface LoadedConfigData {
  data: string;
  configDir: string;
  configPath?: string;
}

export async function loadConfigData(filePath: string): Promise<LoadedConfigData | null> {
  try {
    const data = await fs.readFile(filePath, { encoding: 'utf8' });
    return {
      data,
      configDir: dirname(filePath),
      configPath: filePath,
    };
  }
  catch {
    return null;
  }
}

export async function findConfigData(fileName: string): Promise<LoadedConfigData | null> {
  let dir: string | null = process.cwd();
  do {
    const filePath = join(dir, fileName);
    try {
      const data = await fs.readFile(filePath, { encoding: 'utf8' });
      return {
        data,
        configDir: dir,
        configPath: filePath,
      };
    }
    catch { /* continue */ }
  } while (dir = getParentDir(dir));
  return null;
}

export function emptyConfigData(): LoadedConfigData {
  return { data: '{}', configDir: process.cwd() };
}

export function parseConfig<T>(data: string, defaults: T): T {
  let parsed: Partial<T> = JSON.parse(data);
  const config = Object.assign({}, defaults, parsed);
  return config;
}

export async function saveConfigFile<T>(filePath: string, config: T): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(config, null, 2));
}

function getParentDir(path: string | null): string | null {
  if (path == null) {
    return null;
  }
  const parent = dirname(path);
  if (parent === path) {
    return null;
  }
  return parent;
}
