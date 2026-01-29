import { loadBuildConfig, type ServiceConfig } from "../config/index.js";

/**
 * Get service configurations from build configuration.
 */
export async function getServiceConfigs(configPath?: string, serviceName?: string): Promise<ServiceConfig[]> {
  const config = await loadBuildConfig(configPath);

  let services = config.services;

  if (serviceName) {
    services = config.services.filter((s) => s.name === serviceName);
  }

  return services;
}
