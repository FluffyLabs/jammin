// Custom error types for better error handling

import type { ZodError } from "zod";

export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly filePath?: string,
    public override readonly cause?: Error | ZodError,
  ) {
    super(message);
    this.name = "ConfigError";
  }
}
