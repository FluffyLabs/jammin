import { mkdir } from "node:fs/promises";
import { join, relative } from "node:path";
import * as p from "@clack/prompts";
import type { ServiceConfig } from "@fluffylabs/jammin-sdk";
import { getServiceConfigs } from "@fluffylabs/jammin-sdk";
import { Command } from "commander";
import { DockerError, runSdkDocker } from "../utils/run-sdk-docker.ts";

export { DockerError } from "../utils/run-sdk-docker.ts";

/**
 * Test a single service using Docker
 */
export async function testService(service: ServiceConfig, projectRoot: string): Promise<string> {
  return runSdkDocker(service, projectRoot, "test");
}

/**
 *  Test command definition
 */
export const testCommand = new Command("test")
  .description("run tests for your entire project or a specific service")
  .argument("[service]", "service name to test")
  .addHelpText(
    "after",
    `
Examples:
  $ jammin test
  $ jammin test auth-service
`,
  )
  .action(async (serviceName) => {
    const targetLabel = serviceName ? "service" : "project";
    p.intro(`🧪 Testing ${targetLabel}`);

    const s = p.spinner();
    s.start("Loading service configuration...");
    const services = await getServiceConfigs(serviceName);
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
