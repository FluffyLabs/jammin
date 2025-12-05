import { dirname } from "node:path";
import { YAML } from "bun";
import type { JamminBuildConfig, JamminNetworksConfig, ResolvedServiceConfig, SdkConfig } from "../types/config";
import { ConfigError } from "../types/errors";
import { validateBuildConfig, validateNetworksConfig } from "./config-validator";
import { fileExists, findConfigFile, resolvePathFromConfig } from "./file-utils";

/**
 * Configuration loader with caching and validation
 */

const CONFIG_FILES = {
  BUILD: "jammin.build.yml",
  NETWORKS: "jammin.networks.yml",
} as const;

// Built-in SDK configurations
const BUILTIN_SDKS: Record<string, SdkConfig> = {
  "jam-sdk-0.1.26": {
    type: "builtin",
    buildCommand: "npm run build",
    testCommand: "npm test",
  },
};

/**
 * Load and parse YAML config file using Bun's native YAML support
 */
async function loadYamlFile(filePath: string): Promise<unknown> {
  try {
    const file = Bun.file(filePath);
    const content = await file.text();
    return YAML.parse(content);
  } catch (error) {
    if (error instanceof Error) {
      throw new ConfigError(`Failed to read config file: ${error.message}`, filePath, error);
    }
    throw error;
  }
}

/**
 * Load build configuration
 */
export async function loadBuildConfig(configPath?: string): Promise<JamminBuildConfig> {
  const filePath = configPath || (await findConfigFile(CONFIG_FILES.BUILD));

  if (!filePath) {
    throw new ConfigError(`Config file '${CONFIG_FILES.BUILD}' not found in current directory or parent directories`);
  }

  if (!fileExists(filePath)) {
    throw new ConfigError(`Config file not found: ${filePath}`, filePath);
  }

  const data = await loadYamlFile(filePath);

  try {
    return validateBuildConfig(data);
  } catch (error) {
    throw new ConfigError(
      `Invalid build configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
      filePath,
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Load networks configuration
 */
export async function loadNetworksConfig(configPath?: string): Promise<JamminNetworksConfig> {
  const filePath = configPath || (await findConfigFile(CONFIG_FILES.NETWORKS));

  if (!filePath) {
    throw new ConfigError(
      `Config file '${CONFIG_FILES.NETWORKS}' not found in current directory or parent directories`,
    );
  }

  if (!fileExists(filePath)) {
    throw new ConfigError(`Config file not found: ${filePath}`, filePath);
  }

  const data = await loadYamlFile(filePath);

  try {
    return validateNetworksConfig(data);
  } catch (error) {
    throw new ConfigError(
      `Invalid networks configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
      filePath,
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Resolve SDK configuration (built-in or custom)
 */
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

/**
 * Resolve service configurations with absolute paths and SDK info
 */
export async function resolveServices(
  config: JamminBuildConfig,
  configPath?: string,
): Promise<ResolvedServiceConfig[]> {
  const filePath = configPath || (await findConfigFile(CONFIG_FILES.BUILD));
  const configDir = filePath ? dirname(filePath) : process.cwd();

  const resolved: ResolvedServiceConfig[] = [];

  for (const service of config.services) {
    const absolutePath = resolvePathFromConfig(configDir, service.path);

    if (!fileExists(absolutePath)) {
      throw new ConfigError(
        `Service path does not exist: ${service.path} (resolved to: ${absolutePath})`,
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

/**
 * Filter services by name or pattern
 */
export function filterServices(services: ResolvedServiceConfig[], filter?: string): ResolvedServiceConfig[] {
  if (!filter) {
    return services;
  }

  return services.filter((service) => service.name === filter);
}
