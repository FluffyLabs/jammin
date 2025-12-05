import * as p from "@clack/prompts";
import { Command } from "commander";
import { filterServices, loadBuildConfig, resolveServices } from "../utils/config-loader";
import { handleError } from "../utils/error-handler";
import { testServices } from "../utils/service-executor";

export const testCommand = new Command("test")
  .description("run tests for your project")
  .option("-s, --service <name>", "test specific service only")
  .option("-c, --config <path>", "path to jammin.build.yml")
  .option("-p, --parallel", "run tests in parallel", false)
  .option("-v, --verbose", "show detailed test output", false)
  .option("--fail-fast", "stop on first test failure", false)
  .addHelpText(
    "after",
    `
Examples:
  $ jammin test                           # Test all services
  $ jammin test -s my-service             # Test specific service
  $ jammin test --parallel                # Test all services in parallel
  $ jammin test --fail-fast               # Stop on first failure
`,
  )
  .action(async (options) => {
    const s = p.spinner();

    try {
      // Load configuration
      s.start("Loading configuration...");
      const config = await loadBuildConfig(options.config);
      const allServices = await resolveServices(config, options.config);
      s.stop(`Found ${allServices.length} service(s)`);

      // Filter services if specific service requested
      const servicesToTest = filterServices(allServices, options.service);

      if (servicesToTest.length === 0) {
        p.log.error(`Service '${options.service}' not found in configuration`);
        process.exit(1);
      }

      // Display what will be tested
      p.intro("Running tests...");
      if (options.service) {
        p.log.info(`Testing service: ${options.service}`);
      } else {
        p.log.info(`Testing ${servicesToTest.length} service(s)${options.parallel ? " in parallel" : " sequentially"}`);
      }

      // Test services
      const summary = await testServices(servicesToTest, {
        parallel: options.parallel,
        verbose: options.verbose,
        continueOnError: !options.failFast,
      });

      // Display results
      for (const result of summary.results) {
        if (result.success) {
          p.log.success(`${result.serviceName}: Tests passed (${result.duration}ms)`);
        } else {
          p.log.error(`${result.serviceName}: Tests failed`);
          if (result.error && !options.verbose) {
            p.log.error(`  ${result.error}`);
          }
        }
      }

      // Summary
      if (summary.failed > 0) {
        p.outro(`Tests completed with ${summary.failed} failure(s) out of ${summary.total}`);
        process.exit(1);
      } else {
        p.outro(`All ${summary.successful} service(s) passed tests!`);
      }
    } catch (error) {
      s.stop("Tests failed");
      handleError(error);
    }
  });
