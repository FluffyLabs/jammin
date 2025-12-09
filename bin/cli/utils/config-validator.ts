import { z } from "zod";

// Zod schemas for runtime validation of YAML configs

/** Validates that a path points to a file (not a directory) */
function isValidFilePath(path: string): boolean {
  if (path.endsWith("/")) {
    return false;
  }

  // Extract the last segment of the path (filename)
  const segments = path.split("/");
  const filename = segments[segments.length - 1] || "";

  if (!filename) {
    return false;
  }

  // Check if filename has an extension (contains a dot with characters after it)
  // NOTE: This handles: file.ts, .gitignore, service.test.ts, etc.
  const lastDotIndex = filename.lastIndexOf(".");

  if (lastDotIndex === -1) {
    return false;
  }

  // If dot is at the end (e.g., "file."), reject
  if (lastDotIndex === filename.length - 1) {
    return false;
  }

  // Extract extension and validate it's not empty
  const extension = filename.substring(lastDotIndex + 1);
  return extension.length > 0;
}

// jammin.build.yml schema

const ServiceConfigSchema = z.object({
  path: z
    .string()
    .min(1, "Service path is required")
    .refine(isValidFilePath, "Path must point to a file, not a directory"),
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
  version: z
    .string()
    .min(1, "Version number is required")
    .regex(
      /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/,
      "Version must follow semantic versioning format (e.g., 1.0.0, 1.0.0-alpha, 1.0.0+build)",
    ),
  deploy_with: z.enum(["bootstrap-service", "genesis"]),
  upgrade: z.boolean().optional(),
});

export const JamminBuildConfigSchema = z.object({
  services: z.array(ServiceConfigSchema).min(1, "At least one service is required"),
  sdks: z.record(z.string(), CustomSdkConfigSchema).optional(),
  deployment: DeploymentConfigSchema.optional(),
});

/** Validate and parse build config */
export function validateBuildConfig(data: unknown) {
  return JamminBuildConfigSchema.parse(data);
}
