import { readdir, stat } from "node:fs/promises";
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

/**
 * Recursively get all jam files in a directory with their modification times
 */
export async function getJamFiles(dirPath: string): Promise<Map<string, number>> {
  const files = new Map<string, number>();

  try {
    const entries = await readdir(dirPath, { withFileTypes: true, recursive: true });

    for (const entry of entries) {
      if (entry.name.endsWith(".jam")) {
        try {
          const fullPath = resolve(entry.parentPath, entry.name);
          const stats = await stat(fullPath);
          files.set(fullPath, stats.mtimeMs);
        } catch {
          // Ignore stat errors
        }
      }
    }
  } catch {
    // Ignore errors (e.g., directory doesn't exist or permission issues)
  }

  return files;
}

/**
 * Update fields in package.json
 */
export async function updatePackageJson(
  projectPath: string,
  fields: {
    name: string;
  },
): Promise<void> {
  const packageJsonPath = `${projectPath}/package.json`;

  const file = Bun.file(packageJsonPath);

  if (!(await file.exists())) {
    console.warn("⚠️  No package.json found in template, skipping metadata update");
    return;
  }

  const content = await file.text();
  const packageJson = JSON.parse(content);

  // Update
  packageJson.name = fields.name;

  await Bun.write(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}
