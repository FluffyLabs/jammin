import * as p from "@clack/prompts";
import z, { ZodError } from "zod";
import type { JamminBuildConfig, ServiceConfig } from "../types/config";
import { ConfigError } from "../types/errors";
import { loadBuildConfig } from "./config-loader";

/**
 * Get service configurations from build configuration.
 */
export async function getServiceConfigs(
  configPath?: string,
  serviceName?: string,
  spinner?: ReturnType<typeof p.spinner>,
): Promise<ServiceConfig[]> {
  spinner?.start("Loading service configuration...");
  let config: JamminBuildConfig;
  try {
    config = await loadBuildConfig(configPath);
  } catch (error) {
    if (error instanceof ConfigError && error.cause instanceof ZodError) {
      spinner?.stop("❌ Failed to load build configuration");
      p.log.error(z.prettifyError(error.cause));
      process.exit(1);
    }
    throw error;
  }
  spinner?.stop("✅ Configuration loaded");

  let services = config.services;
  if (serviceName) {
    services = config.services.filter((s) => s.name === serviceName);
    if (services.length === 0) {
      p.log.error(`Service '${serviceName}' not found in configuration`);
      process.exit(1);
    }
  }

  return services;
}
