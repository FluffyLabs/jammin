import { z } from "zod";
import { SDK_CONFIGS } from "./sdk-configs";

// Zod schemas for runtime validation of YAML configs

const MAX_U32 = 4_294_967_295;
const MAX_U64 = 18_446_744_073_709_551_615n;

const u64Schema = () =>
  z
    .string("This number must be provided as a string to ensure proper handling of large numbers.")
    .transform((val, ctx) => {
      try {
        return BigInt(val);
      } catch {
        ctx.addIssue({
          code: "custom",
          message: "This string doesn't represent a valid number.",
        });
        return z.NEVER;
      }
    })
    .pipe(z.bigint().min(0n).max(MAX_U64));
const u32Schema = () => z.number().int().min(0).max(MAX_U32);

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

const ServiceDeploymentConfigSchema = z.object({
  id: u32Schema().optional(),
  storage: z.record(z.string(), z.string()).optional(),
  info: z
    .object({
      balance: u64Schema().optional(),
      accumulate_min_gas: u64Schema().optional(),
      on_transfer_min_gas: u64Schema().optional(),
      storage_utilisation_bytes: u64Schema().optional(),
      gratis_storage: u64Schema().optional(),
      storage_utilisation_count: u32Schema().optional(),
      created: u32Schema().optional(),
      last_accumulation: u32Schema().optional(),
      parent_service: u32Schema().optional(),
    })
    .transform((info) => {
      // snake to camel case
      if (!info) {
        return undefined;
      }
      const transformed = {
        balance: info.balance,
        accumulateMinGas: info.accumulate_min_gas,
        onTransferMinGas: info.on_transfer_min_gas,
        storageUtilisationBytes: info.storage_utilisation_bytes,
        gratisStorage: info.gratis_storage,
        storageUtilisationCount: info.storage_utilisation_count,
        created: info.created,
        lastAccumulation: info.last_accumulation,
        parentService: info.parent_service,
      };
      return transformed;
    })
    .optional(),
});

const DeploymentConfigSchema = z.object({
  spawn: z.string().min(1),
  services: z.record(z.string(), ServiceDeploymentConfigSchema).optional(),
});

export const JamminBuildConfigSchema = z
  .object({
    services: z.array(ServiceConfigSchema).min(1, "At least one service is required"),
    deployment: DeploymentConfigSchema.optional(),
  })
  .superRefine((data, ctx) => {
    // Check for duplicate service names
    const serviceNames = new Set(data.services.map((s) => s.name));
    if (serviceNames.size !== data.services.length) {
      ctx.addIssue({
        code: "custom",
        path: ["services"],
        message: "Service names must be unique",
      });
    }

    // deployment config
    if (!data.deployment || !data.deployment.services) {
      return;
    }
    const deploymentServiceNames = Object.keys(data.deployment.services);
    const serviceIds = new Map<number, string>();

    for (const serviceName of deploymentServiceNames) {
      // Check if service name is defined in build config
      if (!serviceNames.has(serviceName)) {
        ctx.addIssue({
          code: "custom",
          path: ["deployment", "services", serviceName],
          message: `Service '${serviceName}' not found in build config`,
        });
      }

      // Check for duplicate service IDs
      const serviceConfig = data.deployment.services[serviceName];
      if (serviceConfig?.id !== undefined) {
        if (serviceIds.has(serviceConfig.id)) {
          const conflictingService = serviceIds.get(serviceConfig.id);
          ctx.addIssue({
            code: "custom",
            path: ["deployment", "services", serviceName, "id"],
            message: `Service ID ${serviceConfig.id} is already used by service '${conflictingService}'`,
          });
        } else {
          serviceIds.set(serviceConfig.id, serviceName);
        }
      }
    }
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
