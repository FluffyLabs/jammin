import { mkdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import * as p from "@clack/prompts";
import type { ServiceConfig } from "@fluffylabs/jammin-sdk";
import { copyJamToDist, getJamFiles, getServiceConfigs, SDK_CONFIGS } from "@fluffylabs/jammin-sdk";
import { Command } from "commander";
/**
 * Build a single service using Docker
 */
export class DockerError extends Error {
  constructor(
    message: string,
    public output: string,
  ) {
    super(message);
  }
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
    throw new DockerError(`Build failed for service '${service.name}' with exit code ${exitCode}`, combinedOutput);
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
    s.start("Loading service configuration...");
    const services = await getServiceConfigs(options.config, serviceName);
    s.stop("✅ Configuration loaded");

    const projectRoot = process.cwd();
    const logsDir = join(projectRoot, "logs");
    await mkdir(logsDir, { recursive: true });

    let buildFailed = false;

    for (const service of services) {
      p.log.info("--------------------------------");
      s.start(`Building service '${service.name}'...`);
      const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
      const logFileName = `jammin-build-${service.name}-${timestamp}.log`;
      const logFilePath = join(logsDir, logFileName);

      const servicePath = resolve(projectRoot, service.path);
      const filesBefore = await getJamFiles(servicePath);

      let output: string | undefined;

      // Build service and save log
      try {
        output = await buildService(service, projectRoot);
        s.stop(`✅ Service '${service.name}' built successfully`);
      } catch (error) {
        buildFailed = true;
        let errorMessage: string;
        if (error instanceof DockerError) {
          output = error.output;
          errorMessage = error.message;
        } else {
          const errorObj = error instanceof Error ? error : new Error(String(error));
          errorMessage = errorObj.message;
        }
        s.stop(`❌ Failed to build service '${service.name}': ${errorMessage}`);
      }

      // Find new or updated .jam files
      const filesAfter = await getJamFiles(servicePath);
      const newFiles: string[] = [];

      for (const [file, mtimeAfter] of filesAfter) {
        const mtimeBefore = filesBefore.get(file);
        if (mtimeBefore === undefined || mtimeAfter > mtimeBefore) {
          newFiles.push(file);
        }
      }

      const file = newFiles.length > 0 ? newFiles[0] : undefined;
      if (file) {
        const distPath = await copyJamToDist(file, service.name, projectRoot);
        p.log.info(`🎁 Output file: ${relative(projectRoot, distPath)}`);
      } else {
        throw new Error(`Failed to find generated file for: '${service.name}'`);
      }

      if (output) {
        await Bun.write(logFilePath, output);
        p.log.info(`📝 Log saved: ${relative(projectRoot, logFilePath)}`);
      }
    }

    p.log.info("--------------------------------");

    if (buildFailed) {
      p.outro("❌ Build failed. See the output above and check the logs for more details.");
      process.exit(1);
    } else {
      p.outro("✅ Build completed successfully!");
    }
  });
