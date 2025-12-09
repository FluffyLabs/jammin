import { isAbsolute, join, resolve } from "node:path";

/** File system utilities */

/** Check if a file exists at the given path */
export async function fileExists(path: string): Promise<boolean> {
  return await Bun.file(path).exists();
}

export function resolvePathFromCwd(path: string): string {
  return isAbsolute(path) ? path : resolve(process.cwd(), path);
}

export function resolvePathFromConfig(configDir: string, path: string): string {
  return isAbsolute(path) ? path : resolve(configDir, path);
}

/** Find config file in current directory or walk up parent directories */
export async function findConfigFile(fileName: string, startDir: string = process.cwd()): Promise<string | null> {
  let currentDir = resolve(startDir);
  const root = resolve("/");

  while (true) {
    const configPath = join(currentDir, fileName);
    if (await fileExists(configPath)) {
      return configPath;
    }
    if (currentDir === root) {
      break;
    }
    currentDir = resolve(currentDir, "..");
  }

  return null;
}
