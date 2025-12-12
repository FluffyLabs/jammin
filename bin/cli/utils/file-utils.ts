import { stat } from "node:fs/promises";
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
 * Find file in current directory or walk up parent directories
 * Up to git root directory or system root
 */
export async function findFile(fileName: string, startDir: string = process.cwd()): Promise<string | null> {
  let currentDir = resolve(startDir);
  const root = resolve("/");

  while (true) {
    const configPath = join(currentDir, fileName);
    if (await pathExists(configPath)) {
      return configPath;
    }

    // Stop at git root
    const gitPath = join(currentDir, ".git");
    if (await pathExists(gitPath)) {
      break;
    }

    // Stop at system root
    if (currentDir === root) {
      break;
    }

    currentDir = resolve(currentDir, "..");
  }

  return null;
}
