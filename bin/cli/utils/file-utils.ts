import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

/** File system utilities */

/** Check if a path exists (file or directory) */
export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find config file in current directory or walk up parent directories
 * Up to git root directory, home directory or system root
 */
export async function findConfigFile(fileName: string, startDir: string = process.cwd()): Promise<string | null> {
  let currentDir = resolve(startDir);
  const root = resolve("/");
  const home = resolve(homedir());

  while (true) {
    const configPath = join(currentDir, fileName);
    if (await pathExists(configPath)) {
      return configPath;
    }

    // Stop at git project root
    const gitPath = join(currentDir, ".git");
    if (await pathExists(gitPath)) {
      break;
    }

    // Stop at home directory
    if (currentDir === home) {
      break;
    }

    // Stop at root
    if (currentDir === root) {
      break;
    }
    currentDir = resolve(currentDir, "..");
  }

  return null;
}
