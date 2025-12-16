import { mkdir, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import * as p from "@clack/prompts";
import { Command } from "commander";
import type { ServiceConfig } from "../../types/config";
import { loadBuildConfig } from "../../utils/config-loader";
import { SDK_CONFIGS } from "../../utils/sdk-configs";

/**
 * Build a single service using Docker
 */
export type BuildError = Error & { output?: string };

/**
 * Recursively get all files in a directory with their modification times
 */
async function getAllFiles(dirPath: string): Promise<Map<string, number>> {
  const files = new Map<string, number>();

  try {
    const entries = await readdir(dirPath, { withFileTypes: true, recursive: true });

    for (const entry of entries) {
      if (entry.name.endsWith(".jam")) {
        try {
          const fullPath = resolve(entry.parentPath, entry.name);
          const stats = await stat(fullPath);
          files.set(fullPath, stats.mtimeMs);
        } catch {
          // Ignore stat errors
        }
      }
    }
  } catch {
    // Ignore errors (e.g., directory doesn't exist or permission issues)
  }

  return files;
}

export async function buildService(service: ServiceConfig, projectRoot: string): Promise<string> {
  const sdk = typeof service.sdk === "string" ? SDK_CONFIGS[service.sdk] : service.sdk;
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

      const servicePath = resolve(projectRoot, service.path);
      const filesBefore = await getAllFiles(servicePath);

      let output: string | undefined;

      // Build service and save log
      try {
        output = await buildService(service, projectRoot);
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

      // Find new or updated .jam files
      const filesAfter = await getAllFiles(servicePath);
      const newFiles: string[] = [];

      for (const [file, mtimeAfter] of filesAfter) {
        const mtimeBefore = filesBefore.get(file);
        if (mtimeBefore === undefined || mtimeAfter > mtimeBefore) {
          newFiles.push(file);
        }
      }

      if (newFiles.length > 0) {
        const filesList = newFiles.map((f) => `  - ${f}`).join("\n");
        p.log.info(`🎁 Output files for '${service.name}':\n${filesList}`);
      }
    }

    const logFilesList = logFiles.map((f) => `  - ${f}`).join("\n");
    const logsMessage = logFiles.length > 0 ? `\n\nLogs saved to:\n${logFilesList}` : "";

    if (buildFailed) {
      p.log.error(lastError?.message || "Build failed");
      p.outro(`❌ Build failed ${logsMessage}`);
      process.exit(1);
    } else {
      p.outro(`✅ Build completed successfully! ${logsMessage}`);
    }
  });
