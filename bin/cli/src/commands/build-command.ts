import { mkdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import * as p from "@clack/prompts";
import type { ServiceConfig } from "@fluffylabs/jammin-sdk";
import {
  copyJamToDist,
  generateTestConfigInProjectDir,
  getJamFiles,
  getServiceConfigs,
  loadServices,
  SDK_CONFIGS,
} from "@fluffylabs/jammin-sdk";
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

export async function callDockerBuild(service: ServiceConfig, projectRoot: string): Promise<string> {
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

export async function buildService(service: ServiceConfig, projectRoot: string): Promise<string> {
  const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const logsDir = join(projectRoot, "logs");
  await mkdir(logsDir, { recursive: true });
  const logFileName = `jammin-build-${service.name}-${timestamp}.log`;
  const logFilePath = join(logsDir, logFileName);

  const servicePath = resolve(projectRoot, service.path);
  const output = await callDockerBuild(service, projectRoot);

  const files = await getJamFiles(servicePath);

  const file = files.length > 0 ? files[0] : undefined;
  let distPath: string | undefined;
  if (file) {
    distPath = await copyJamToDist(file, service.name, projectRoot);
  } else {
    throw new Error(`Failed to find generated file for: '${service.name}'`);
  }

  if (output) {
    await Bun.write(logFilePath, output);
  }

  return relative(projectRoot, distPath);
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

    const buildFailed = false;

    for (const service of services) {
      p.log.info("--------------------------------");

      s.start(`Building service '${service.name}'...`);
      const createdFile = await buildService(service, projectRoot);
      s.stop(`✅ Service '${service.name}' built successfully`);

      p.log.message(`🎁 Output file: ${createdFile}`);
    }

    p.log.info("--------------------------------");

    // Generate test configuration file
    try {
      s.start("Generating test configuration...");
      const services = await loadServices(projectRoot);
      await generateTestConfigInProjectDir(services, projectRoot);
      s.stop("✅ Test configuration generated");
      p.log.message("📝 Generated: config/jammin.test.config.ts");
    } catch (_error) {
      s.stop("⚠️ Could not generate test configuration");
      p.log.warn("Test configuration generation failed (this is optional)");
    }

    if (buildFailed) {
      p.outro("❌ Build failed. See the output above and check the logs for more details.");
      process.exit(1);
    } else {
      p.outro("✅ Build completed successfully!");
    }
  });
