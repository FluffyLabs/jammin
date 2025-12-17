// Custom error types for better error handling

export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly filePath?: string,
  ) {
    super(message);
    this.name = "ConfigError";
  }
}
