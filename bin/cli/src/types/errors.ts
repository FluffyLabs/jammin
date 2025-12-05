/**
 * Custom error types for better error handling
 */

export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly filePath?: string,
    public override readonly cause?: Error,
  ) {
    super(message);
    this.name = "ConfigError";
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ServiceExecutionError extends Error {
  constructor(
    message: string,
    public readonly serviceName: string,
    public readonly command: string,
    public readonly exitCode?: number,
  ) {
    super(message);
    this.name = "ServiceExecutionError";
  }
}
