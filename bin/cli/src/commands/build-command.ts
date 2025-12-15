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
async function buildService(service: ServiceConfig, projectRoot: string, logFilePath: string): Promise<void> {
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

  await Bun.write(logFilePath, combinedOutput);

  if (exitCode !== 0) {
    throw new Error(`Build failed for service '${service.name}' with exit code ${exitCode}`);
  }
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
    try {
      const targetLabel = serviceName ? `service '${serviceName}'` : "project";
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

        try {
          await buildService(service, projectRoot, logFilePath);
          logFiles.push(logFilePath);
          s.stop(`✅ Service '${service.name}' built successfully`);
        } catch (error) {
          buildFailed = true;
          lastError = error instanceof Error ? error : new Error(String(error));
          logFiles.push(logFilePath);
          s.stop(`❌ Failed to build service '${service.name}'`);
        }
      }

      const logFilesList = logFiles.map((f) => `  - ${f}`).join("\n");
      if (buildFailed) {
        p.log.error(lastError?.message || "Build failed");
        p.outro(`❌ Build failed\n\nBuild logs saved to:\n${logFilesList}`);
        process.exit(1);
      } else {
        p.outro(`✅ Build completed successfully!\n\nBuild logs saved to:\n${logFilesList}`);
      }
    } catch (error) {
      if (error instanceof ConfigError) {
        p.log.error(error.message);
        if (error.filePath) {
          p.log.error(`Config file: ${error.filePath}`);
        }
      } else {
        p.log.error(error instanceof Error ? error.message : String(error));
      }
      process.exit(1);
    }
  });
