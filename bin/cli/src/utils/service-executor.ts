import type { ExecutionSummary, ResolvedServiceConfig, ServiceExecutionResult } from "../types/config";

/**
 * Service command execution with parallel/sequential support
 */

interface ExecutionOptions {
  parallel?: boolean;
  verbose?: boolean;
  continueOnError?: boolean;
}

/**
 * Execute a command for a single service
 */
async function executeServiceCommand(
  service: ResolvedServiceConfig,
  command: string,
  options: ExecutionOptions = {},
): Promise<ServiceExecutionResult> {
  const startTime = Date.now();

  try {
    const result = await Bun.$`cd ${service.absolutePath} && ${command}`.quiet(!options.verbose);

    return {
      serviceName: service.name,
      success: result.exitCode === 0,
      output: result.stdout.toString(),
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const bunError = error as { stderr?: { toString(): string }; message: string };
    return {
      serviceName: service.name,
      success: false,
      error: bunError.stderr?.toString() || bunError.message,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Execute command for multiple services (parallel or sequential)
 */
export async function executeForServices(
  services: ResolvedServiceConfig[],
  getCommand: (service: ResolvedServiceConfig) => string,
  options: ExecutionOptions = {},
): Promise<ExecutionSummary> {
  const results: ServiceExecutionResult[] = [];

  if (options.parallel) {
    // Execute all services in parallel
    const promises = services.map((service) => executeServiceCommand(service, getCommand(service), options));
    results.push(...(await Promise.all(promises)));
  } else {
    // Execute services sequentially
    for (const service of services) {
      const result = await executeServiceCommand(service, getCommand(service), options);
      results.push(result);

      // Stop on first error if continueOnError is false
      if (!result.success && !options.continueOnError) {
        break;
      }
    }
  }

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return {
    total: results.length,
    successful,
    failed,
    results,
  };
}

/**
 * Build all services
 */
export async function buildServices(
  services: ResolvedServiceConfig[],
  options: ExecutionOptions = {},
): Promise<ExecutionSummary> {
  return executeForServices(services, (service) => service.sdkConfig.buildCommand, options);
}

/**
 * Test all services
 */
export async function testServices(
  services: ResolvedServiceConfig[],
  options: ExecutionOptions = {},
): Promise<ExecutionSummary> {
  return executeForServices(services, (service) => service.sdkConfig.testCommand, options);
}
