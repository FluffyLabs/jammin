import { mkdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import * as p from "@clack/prompts";
import type { ServiceConfig } from "@fluffylabs/jammin-sdk";
import { getServiceConfigs, SDK_CONFIGS } from "@fluffylabs/jammin-sdk";
import { Command } from "commander";

export class DockerError extends Error {
  constructor(
    message: string,
    public output: string,
  ) {
    super(message);
  }
}

/**
 * Test a single service using Docker
 */
export async function testService(service: ServiceConfig, projectRoot: string): Promise<string> {
  const sdk = typeof service.sdk === "string" ? SDK_CONFIGS[service.sdk] : service.sdk;
  const servicePath = resolve(projectRoot, service.path);

  const dockerArgs = ["run", "--rm", "-v", `${servicePath}:/app`, sdk.image, ...sdk.test.split(" ")];
  const dockerCommand = `docker ${dockerArgs.join(" ")}`;

  const proc = Bun.spawn(["sh", "-c", `${dockerCommand} 2>&1`], {
    stdout: "pipe",
    stderr: "pipe",
    cwd: projectRoot,
  });

  const [combinedOutput, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);

  if (exitCode !== 0) {
    throw new DockerError(`Tests failed for service '${service.name}' with exit code ${exitCode}`, combinedOutput);
  }

  return combinedOutput;
}

/**
 *  Test command definition
 */
export const testCommand = new Command("test")
  .description("run tests for your entire project or a specific service")
  .argument("[service]", "service name to test")
  .option("-c, --config <path>", "path to build config file")
  .addHelpText(
    "after",
    `
Examples:
  $ jammin test
  $ jammin test auth-service
  $ jammin test --config ./custom.build.yml
`,
  )
  .action(async (serviceName, options) => {
    const targetLabel = serviceName ? "service" : "project";
    p.intro(`🧪 Testing ${targetLabel}`);

    const s = p.spinner();
    s.start("Loading service configuration...");
    const services = await getServiceConfigs(options.config, serviceName);
    s.stop("✅ Configuration loaded");

    const projectRoot = process.cwd();
    const logsDir = join(projectRoot, "logs");
    await mkdir(logsDir, { recursive: true });

    let testFailed = false;

    for (const service of services) {
      p.log.info("--------------------------------");
      s.start(`Running tests for service '${service.name}'...`);
      const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
      const logFileName = `jammin-test-${service.name}-${timestamp}.log`;
      const logFilePath = join(logsDir, logFileName);

      let output: string | undefined;

      // Test service and save log
      try {
        output = await testService(service, projectRoot);
        s.stop(`✅ Service '${service.name}' tests passed`);
      } catch (error) {
        testFailed = true;
        let errorMessage: string;
        if (error instanceof DockerError) {
          output = error.output;
          errorMessage = error.message;
        } else {
          const errorObj = error instanceof Error ? error : new Error(String(error));
          errorMessage = errorObj.message;
        }
        s.stop(`❌ Service '${service.name}' tests failed: ${errorMessage}`);
      }

      if (output) {
        await Bun.write(logFilePath, output);
        p.log.info(`📝 Log saved: ${relative(projectRoot, logFilePath)}`);
      }
    }

    p.log.info("--------------------------------");

    if (testFailed) {
      p.outro("❌ Some tests failed. See the output above and check the logs for more details.");
      process.exit(1);
    } else {
      p.outro("✅ All tests passed!");
    }
  });
