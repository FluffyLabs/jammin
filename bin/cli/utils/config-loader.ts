import { YAML } from "bun";
import { ZodError } from "zod";
import type { JamminBuildConfig, JamminNetworksConfig } from "../types/config";
import { findConfigFile, pathExists } from "../utils/file-utils";
import { validateBuildConfig, validateNetworksConfig } from "./config-validator";

/** Configuration loader and validation */

export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly filePath?: string,
  ) {
    super(message);
    this.name = "ConfigError";
  }
}

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
      throw new ConfigError(`Failed to parse YAML file: ${error.message}`, filePath);
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
    throw new ConfigError("Config file not found", filePath);
  }

  const data = await loadYamlFile(filePath);

  try {
    return validator(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const details = formatZodError(error);
      throw new ConfigError(`Invalid '${configType}' configuration: ${details}`, filePath);
    }
    if (error instanceof Error) {
      throw new ConfigError(`Invalid '${configType}' configuration: ${error.message}`, filePath);
    }
    throw new ConfigError(`Invalid '${configType}' configuration`, filePath);
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

/** Format Zod validation errors into readable messages */
function formatZodError(error: ZodError): string {
  const issues = error.issues.map((i) => {
    const path = i.path.length > 0 ? i.path.join(".") : "root";
    return `  -  ${path}: ${i.message}`;
  });
  return issues.join("\n");
}
