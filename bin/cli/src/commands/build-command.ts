import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import * as p from "@clack/prompts";
import { Command } from "commander";
import type { SdkConfig, ServiceConfig } from "../../types/config";
import { ConfigError } from "../../types/errors";
import { loadBuildConfig } from "../../utils/config-loader";
import { SDK_CONFIGS } from "../../utils/sdk-configs";

/**
 *  Resolve SDK string or config to SDK config
 */
function resolveSdk(sdk: string | SdkConfig): SdkConfig {
  if (typeof sdk === "string") {
    const predefinedConfig = SDK_CONFIGS[sdk];
    if (!predefinedConfig) {
      throw new ConfigError(`Unknown SDK '${sdk}'. Use a predefined SDK name or provide a custom SDK config.`);
    }
    return predefinedConfig;
  }
  return sdk;
}

/**
 * Build a single service using Docker
 */
type BuildError = Error & { output?: string };

async function buildService(service: ServiceConfig, projectRoot: string): Promise<string> {
  const sdk = resolveSdk(service.sdk);
  const servicePath = resolve(projectRoot, service.path);

  const dockerArgs = ["run", "--rm", "-v", `${servicePath}:/app`, sdk.image, ...sdk.build.split(" ")];
  const dockerCommand = `docker ${dockerArgs.join(" ")}`;

  const proc = Bun.spawn(["sh", "-c", `${dockerCommand} 2>&1`], {
    stdout: "pipe",
    stderr: "pipe",
    cwd: projectRoot,
  });

  const [combinedOutput, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);

  if (exitCode !== 0) {
    const error: BuildError = new Error(`Build failed for service '${service.name}' with exit code ${exitCode}`);
    error.output = combinedOutput;
    throw error;
  }

  return combinedOutput;
}

/**
 *  Build command definition
 */
export const buildCommand = new Command("build")
  .description("build your entire project or a specific service")
  .argument("[service]", "service name to build")
  .option("-c, --config <path>", "path to build config file")
  .addHelpText(
    "after",
    `
Examples:
  $ jammin build
  $ jammin build auth-service
  $ jammin build --config ./custom.build.yml
`,
  )
  .action(async (serviceName, options) => {
    const targetLabel = serviceName ? "service" : "project";
    p.intro(`🔨 Building ${targetLabel}`);

    const s = p.spinner();
    s.start("Loading build configuration...");
    const config = await loadBuildConfig(options.config);
    s.stop("✅ Configuration loaded");

    let servicesToBuild = config.services;
    if (serviceName) {
      servicesToBuild = config.services.filter((s) => s.name === serviceName);
      if (servicesToBuild.length === 0) {
        p.log.error(`Service '${serviceName}' not found in configuration`);
        process.exit(1);
      }
    }

    const projectRoot = process.cwd();
    const logsDir = join(projectRoot, "logs");
    await mkdir(logsDir, { recursive: true });

    const logFiles: string[] = [];
    let buildFailed = false;
    let lastError: Error | null = null;

    for (const service of servicesToBuild) {
      s.start(`Building service '${service.name}'...`);
      const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
      const logFileName = `jammin-build-${service.name}-${timestamp}.log`;
      const logFilePath = join(logsDir, logFileName);

      let output: string | undefined;

      try {
        output = await buildService(service, projectRoot);
        await Bun.write(logFilePath, output);
        s.stop(`✅ Service '${service.name}' built successfully`);
      } catch (error) {
        buildFailed = true;
        lastError = error instanceof Error ? error : new Error(String(error));
        output = (lastError as BuildError).output;
        s.stop(`❌ Failed to build service '${service.name}'`);
      }

      if (output) {
        await Bun.write(logFilePath, output);
        logFiles.push(logFilePath);
      }
    }

    const logFilesList = logFiles.map((f) => `  - ${f}`).join("\n");
    const logsMessage = logFiles.length > 0 ? `\n\nDetailed build logs saved to:\n${logFilesList}` : "";

    if (buildFailed) {
      p.log.error(lastError?.message || "Build failed");
      p.outro(`❌ Build failed ${logsMessage}`);
      process.exit(1);
    } else {
      p.outro(`✅ Build completed successfully! ${logsMessage}`);
    }
  });
