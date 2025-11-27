import { Command } from "commander";
import * as p from "@clack/prompts";

export const deployCommand = new Command("deploy")
  .description("deploy your services to target environment")
  .requiredOption("-e, --env <environment>", "target environment (mainnet, testnet, local)")
  .option("-s, --service <name>", "deploy specific service only")
  .option("--skip-build", "skip building before deploy")
  .addHelpText("after", `
Examples:
  $ jammin deploy --env mainnet
  $ jammin deploy --env local --service api
`)
  .action(async (options) => {
    p.intro(`🚀 Deploying to ${options.env}...`);
    const s = p.spinner();
    if (!options.skipBuild) {
      s.start("🔨 Building...");
      await new Promise(resolve => setTimeout(resolve, 2000));
      s.stop("✅ Building was successful!");
    }

    if (options.service) {
      s.start(`Deploying only ${options.service} service`);
    } else {
      s.start("Deploying all services");
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
    s.stop("✅ Deployment was succesful!");

    p.outro("✅ Finished!");
});
