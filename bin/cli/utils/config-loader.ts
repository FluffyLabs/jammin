import { dirname } from "node:path";
import { YAML } from "bun";
import type { JamminBuildConfig, ResolvedServiceConfig, SdkConfig } from "../types/config";
import { ConfigError } from "../types/errors";
import { validateBuildConfig } from "./config-validator";
import { fileExists, findConfigFile, resolvePathFromConfig } from "./file-utils";

/** Configuration loader and validation */

/** Default config files */
const CONFIG_FILES = {
  BUILD: "jammin.build.yml",
} as const;

/**
 * Built-in SDKs configurations
 * TODO: [MaSo] Build and test commands should be updated to actual build and test commands
 */
const BUILTIN_SDKS: Record<string, SdkConfig> = {
  "jam-sdk-0.1.26": {
    type: "builtin",
    buildCommand: "bun run build",
    testCommand: "bun test",
  },
};

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

  if (!(await fileExists(filePath))) {
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

/** Resolve SDK configuration (built-in or custom) */
function resolveSdkConfig(
  sdkName: string,
  customSdks?: Record<string, { image: string; build: string; test: string }>,
): SdkConfig {
  // Check built-in SDKs first
  if (BUILTIN_SDKS[sdkName]) {
    return BUILTIN_SDKS[sdkName];
  }

  // Check custom SDKs
  if (customSdks?.[sdkName]) {
    const custom = customSdks[sdkName];
    return {
      type: "custom",
      buildCommand: custom.build,
      testCommand: custom.test,
      image: custom.image,
    };
  }

  throw new ConfigError(`Unknown SDK: ${sdkName}. Not found in built-in or custom SDKs.`);
}

/** Resolve service configurations with absolute paths and SDK info */
export async function resolveServices(
  config: JamminBuildConfig,
  configPath?: string,
): Promise<ResolvedServiceConfig[]> {
  const filePath = configPath || (await findConfigFile(CONFIG_FILES.BUILD));
  const configDir = filePath ? dirname(filePath) : process.cwd();

  const resolved: ResolvedServiceConfig[] = [];

  for (const service of config.services) {
    const absolutePath = resolvePathFromConfig(configDir, service.path);

    if (!(await fileExists(absolutePath))) {
      throw new ConfigError(
        `Service file does not exist: ${service.path} (resolved to: ${absolutePath})`,
        filePath || undefined,
      );
    }

    const sdkConfig = resolveSdkConfig(service.sdk, config.sdks);

    resolved.push({
      ...service,
      absolutePath,
      sdkConfig,
    });
  }

  return resolved;
}

/** Filter services by name or pattern */
export function filterServices(services: ResolvedServiceConfig[], filter?: string): ResolvedServiceConfig[] {
  if (!filter) {
    return services;
  }

  return services.filter((service) => service.name === filter);
}
