import * as p from "@clack/prompts";
import { ZodError } from "zod";
import { ConfigError, ServiceExecutionError, ValidationError } from "../types/errors";

/**
 * Centralized error handling with @clack/prompts formatting
 */

export function handleError(error: unknown): never {
  if (error instanceof ConfigError) {
    p.log.error(`Configuration Error: ${error.message}`);
    if (error.filePath) {
      p.log.error(`File: ${error.filePath}`);
    }
    if (error.cause) {
      p.log.error(`Cause: ${error.cause.message}`);
    }
  } else if (error instanceof ZodError) {
    p.log.error("Configuration Validation Failed:");
    for (const issue of error.issues) {
      p.log.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
  } else if (error instanceof ValidationError) {
    p.log.error(`Validation Error: ${error.message}`);
    for (const [field, messages] of Object.entries(error.errors)) {
      for (const message of messages) {
        p.log.error(`  - ${field}: ${message}`);
      }
    }
  } else if (error instanceof ServiceExecutionError) {
    p.log.error(`Service Execution Failed: ${error.serviceName}`);
    p.log.error(`Command: ${error.command}`);
    if (error.exitCode) {
      p.log.error(`Exit code: ${error.exitCode}`);
    }
  } else if (error instanceof Error) {
    p.log.error(`Error: ${error.message}`);
  } else {
    p.log.error(`Unknown error: ${String(error)}`);
  }

  process.exit(1);
}
