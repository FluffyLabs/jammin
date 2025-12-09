import * as p from "@clack/prompts";
import { Command } from "commander";
import { filterServices, loadBuildConfig, resolveServices } from "../utils/config-loader";
import { handleError } from "../utils/error-handler";
import { buildServices } from "../utils/service-executor";

export const buildCommand = new Command("build")
  .description("build your multi-service project")
  .option("-s, --service <name>", "build specific service only")
  .option("-c, --config <path>", "path to jammin.build.yml")
  .option("-p, --parallel", "build services in parallel", false)
  .option("-v, --verbose", "show detailed build output", false)
  .option("--fail-fast", "stop on first build service failure", false)

  .addHelpText(
    "after",
    `
Examples:
  $ jammin build                          # Build all services
  $ jammin build -s my-service            # Build specific service
  $ jammin build --parallel               # Build all services in parallel
  $ jammin build --fail-fast              # Stop on first build failure
  $ jammin build --config ./custom.yml    # Use custom config file
`,
  )
  .action(async (options) => {
    const s = p.spinner();

    try {
      s.start("Loading configuration...");
      const config = await loadBuildConfig(options.config);
      const allServices = await resolveServices(config, options.config);
      s.stop(`Found ${allServices.length} service(s)`);

      // Filter services if specific service requested
      const servicesToBuild = filterServices(allServices, options.service);

      if (servicesToBuild.length === 0) {
        p.log.error(`Service '${options.service}' not found in configuration`);
        process.exit(1);
      }

      if (options.service) {
        p.log.info(`Building service: ${options.service}`);
      } else {
        p.log.info(
          `Building ${servicesToBuild.length} service(s)${options.parallel ? " in parallel" : " sequentially"}`,
        );
      }

      s.start("Building...");
      const summary = await buildServices(servicesToBuild, {
        parallel: options.parallel,
        verbose: options.verbose,
        continueOnError: !options.failFast,
      });
      s.stop();

      for (const result of summary.results) {
        if (result.success) {
          p.log.success(`${result.serviceName}: Built successfully (${result.duration}ms)`);
        } else {
          p.log.error(`${result.serviceName}: Build failed`);
          if (result.error && !options.verbose) {
            p.log.error(`  ${result.error}`);
          }
        }
      }

      if (summary.failed > 0) {
        p.outro(`Build completed with ${summary.failed} failure(s) out of ${summary.total}`);
        process.exit(1);
      } else {
        p.outro(`All ${summary.successful} service(s) built successfully!`);
      }
    } catch (error) {
      s.stop("Build failed");
      handleError(error);
    }
  });
