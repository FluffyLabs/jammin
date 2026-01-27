import { parse } from "yaml";
import { ZodError } from "zod";
import type { JamminBuildConfig, JamminNetworksConfig } from "../types/config";
import { ConfigError } from "../types/errors";
import { findConfigFile, pathExists } from "../utils/file-utils";
import { validateBuildConfig, validateNetworksConfig } from "./config-validator";

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
    return parse(
      content,
      (_, value) => {
        if (typeof value === "bigint" && value >= Number.MIN_SAFE_INTEGER && value <= Number.MAX_SAFE_INTEGER) {
          return Number(value);
        }
        return value;
      },
      { intAsBigInt: true },
    );
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
    const errorObj = error instanceof Error || error instanceof ZodError ? error : new Error(String(error));
    throw new ConfigError(`Invalid ${configType} configuration`, filePath, errorObj);
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
