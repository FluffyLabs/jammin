import { YAML } from "bun";
import type { JamminBuildConfig } from "../types/config";
import { ConfigError } from "../types/errors";
import { validateBuildConfig } from "./config-validator";
import { findConfigFile, pathExists } from "./file-utils";

/** Configuration loader and validation */

/** Default config files */
const CONFIG_FILES = {
  BUILD: "jammin.build.yml",
} as const;

/** Load and parse YAML config file */
async function loadYamlFile(filePath: string): Promise<unknown> {
  try {
    const file = Bun.file(filePath);
    const content = await file.text();
    return YAML.parse(content);
  } catch (error) {
    if (error instanceof Error) {
      throw new ConfigError("Failed to parse YAML file", filePath, error);
    }
    throw error;
  }
}

/** Generic config loader with validation */
async function loadConfig<T>(
  configPath: string | undefined,
  configFileName: string,
  validator: (data: unknown) => T,
  configType: string,
): Promise<T> {
  const filePath = configPath || (await findConfigFile(configFileName));

  if (!filePath) {
    throw new ConfigError(`Config file '${configFileName}' not found in current directory or parent directories`);
  }

  if (!(await pathExists(filePath))) {
    throw new ConfigError(`Config file not found: ${filePath}`, filePath);
  }

  const data = await loadYamlFile(filePath);

  try {
    return validator(data);
  } catch (error) {
    if (error instanceof Error) {
      throw new ConfigError(`Invalid ${configType} configuration`, filePath, error);
    }
    throw new ConfigError(`Invalid ${configType} configuration`, filePath);
  }
}

/** Load build configuration */
export async function loadBuildConfig(configPath?: string): Promise<JamminBuildConfig> {
  return loadConfig(configPath, CONFIG_FILES.BUILD, validateBuildConfig, "build");
}
