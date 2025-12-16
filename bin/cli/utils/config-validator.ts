import { z } from "zod";
import { SDK_CONFIGS } from "./sdk-configs";

// Zod schemas for runtime validation of YAML configs

// jammin.build.yml schema

export const SdkConfigSchema = z.object({
  image: z.string().min(1, "SDK image is required"),
  build: z.string().min(1, "Build command is required"),
  test: z.string().min(1, "Test command is required"),
});

const ServiceConfigSchema = z.object({
  path: z.string().min(1, "Service path is required"),
  name: z
    .string()
    .min(1, "Service name is required")
    .regex(/^[a-zA-Z0-9_-]+$/, "Service name must contain only letters, numbers, hyphens, and underscores"),
  sdk: z.union(
    [z.enum(Object.keys(SDK_CONFIGS) as (keyof typeof SDK_CONFIGS)[]), SdkConfigSchema],
    `Expected a valid custom SDK configuration or one of the supported SDK ids (${Object.keys(SDK_CONFIGS).join(", ")})`,
  ),
});

const DeploymentConfigSchema = z.object({
  spawn: z.string().min(1),
});

export const JamminBuildConfigSchema = z.object({
  services: z.array(ServiceConfigSchema).min(1, "At least one service is required"),
  deployment: DeploymentConfigSchema.optional(),
});

// jammin.network.yml schema

const NodeDefinitionSchema = z.object({
  image: z.string().min(1, "Node image is required"),
  args: z.string().optional(),
  instances: z.number().int().positive().optional().default(1),
});

const NetworkDefinitionSchema = z.array(NodeDefinitionSchema);

const NetworkComposeSchema = z.object({
  compose: z.string().min(1, "Docker compose file path is required"),
});

const NetworkConfigSchema = z.union([NetworkDefinitionSchema, NetworkComposeSchema]);

export const JamminNetworksConfigSchema = z
  .object({
    networks: z.record(z.string(), NetworkConfigSchema),
  })
  .refine((data) => Object.keys(data.networks).length > 0, {
    error: "At least one network must be defined",
    path: ["networks"],
  });

/** Validate and parse build config */
export function validateBuildConfig(data: unknown) {
  return JamminBuildConfigSchema.parse(data);
}

/** Validate and parse networks config */
export function validateNetworksConfig(data: unknown) {
  return JamminNetworksConfigSchema.parse(data);
}
