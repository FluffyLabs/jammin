import { z } from "zod";

/**
 * Zod schemas for runtime validation of YAML configs
 * Provides detailed error messages and type safety
 */

// ============ jammin.build.yml schema ============

const ServiceConfigSchema = z.object({
  path: z.string().min(1, "Service path is required"),
  name: z
    .string()
    .min(1, "Service name is required")
    .regex(/^[a-zA-Z0-9_-]+$/, "Service name must contain only letters, numbers, hyphens, and underscores"),
  sdk: z.string().min(1, "SDK is required"),
});

const CustomSdkConfigSchema = z.object({
  image: z.string().min(1, "SDK image is required"),
  build: z.string().min(1, "Build command is required"),
  test: z.string().min(1, "Test command is required"),
});

const DeploymentConfigSchema = z.object({
  spawn: z.string().min(1),
  deploy_with: z.enum(["bootstrap-service", "genesis"]),
  upgrade: z.boolean().optional(),
});

export const JamminBuildConfigSchema = z.object({
  services: z.array(ServiceConfigSchema).min(1, "At least one service is required"),
  sdks: z.record(z.string(), CustomSdkConfigSchema).optional(),
  deployment: DeploymentConfigSchema.optional(),
});

// ============ jammin.networks.yml schema ============

const ContainerDefinitionSchema = z.object({
  image: z.string().min(1, "Container image is required"),
  args: z.string().optional(),
  instances: z.number().int().positive().optional().default(1),
});

const ContainerNetworkConfigSchema = z.array(ContainerDefinitionSchema);

const ComposeNetworkConfigSchema = z.object({
  compose: z.string().min(1, "Docker compose file path is required"),
});

const NetworkConfigSchema = z.union([ContainerNetworkConfigSchema, ComposeNetworkConfigSchema]);

export const JamminNetworksConfigSchema = z.object({
  networks: z.record(z.string(), NetworkConfigSchema),
});

/**
 * Validate and parse build config
 */
export function validateBuildConfig(data: unknown) {
  return JamminBuildConfigSchema.parse(data);
}

/**
 * Validate and parse networks config
 */
export function validateNetworksConfig(data: unknown) {
  return JamminNetworksConfigSchema.parse(data);
}
