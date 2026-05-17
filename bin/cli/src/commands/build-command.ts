import { mkdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import * as p from "@clack/prompts";
import type { ServiceConfig } from "@fluffylabs/jammin-sdk";
import {
  copyJamToDist,
  generateTestConfigInProjectDir,
  getJamFiles,
  loadBuildConfig,
  loadServices,
} from "@fluffylabs/jammin-sdk";
import { Command } from "commander";
import { runSdkDocker } from "../utils/run-sdk-docker.ts";

export { DockerError } from "../utils/run-sdk-docker.ts";

/**
 * Build a single service using Docker
 */
export async function callDockerBuild(service: ServiceConfig, projectRoot: string): Promise<string> {
  return runSdkDocker(service, projectRoot, "build");
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
  .addHelpText(
    "after",
    `
Examples:
  $ jammin build
  $ jammin build auth-service
`,
  )
  .action(async (serviceName) => {
    const targetLabel = serviceName ? "service" : "project";
    p.intro(`🔨 Building ${targetLabel}`);

    const s = p.spinner();
    s.start("Loading service configuration...");
    const config = await loadBuildConfig();
    const services = serviceName ? config.services.filter((svc) => svc.name === serviceName) : config.services;
    if (serviceName && services.length === 0) {
      s.stop(`❌ Service '${serviceName}' not found in jammin.build.yml`);
      p.outro("❌ Build aborted.");
      process.exit(1);
    }
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

    try {
      s.start("Generating test configuration...");
      const buildOutputs = await loadServices(config, projectRoot);
      await generateTestConfigInProjectDir(buildOutputs, projectRoot);
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
