import { YAML } from "bun";
import { prettifyError, ZodError } from "zod";
import { findConfigFile, pathExists } from "../utils/file-utils.js";
import { validateBuildConfig, validateNetworksConfig } from "./config-validator.js";
import type { JamminBuildConfig, JamminNetworksConfig } from "./types/config.js";
import { ConfigError } from "./types/errors.js";

/** Configuration loader and validation */

/** Default config files */
const CONFIG_FILES = {
  BUILD: "jammin.build.yml",
  NETWORKS: "jammin.networks.yml",
} as const;

/** Load and parse YAML config file */
async function loadYamlFile(filePath: string): Promise<unknown> {
  try {
    const file = Bun.file(filePath);
    const content = await file.text();
    return YAML.parse(content);
  } catch (error) {
    if (error instanceof Error) {
      throw new ConfigError(`Failed to parse YAML file: \n${error.message}`, filePath);
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
    const errorMessage =
      error instanceof ZodError ? prettifyError(error) : error instanceof Error ? error.message : String(error);
    throw new ConfigError(`Invalid ${configType} configuration: \n${errorMessage}`, filePath);
  }
}

/** Load build configuration */
export async function loadBuildConfig(configPath?: string): Promise<JamminBuildConfig> {
  return loadConfig(configPath, CONFIG_FILES.BUILD, validateBuildConfig, "build");
}

/** Load networks configuration */
export async function loadNetworksConfig(configPath?: string): Promise<JamminNetworksConfig> {
  return loadConfig(configPath, CONFIG_FILES.NETWORKS, validateNetworksConfig, "networks");
}
