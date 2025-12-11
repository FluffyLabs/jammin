// Custom error types for better error handling

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
