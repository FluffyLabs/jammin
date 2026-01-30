import * as p from "@clack/prompts";
import { generateGenesis, getServiceConfigs, loadServices, saveStateFile } from "@fluffylabs/jammin-sdk";
import { Command } from "commander";
import { buildService } from "./build-command";

export class DeployError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeployError";
  }
}

export const deployCommand = new Command("deploy")
  .description("deploy your services to target environment")
  .argument("[service]", "service name to deploy")
  .addHelpText(
    "after",
    `
Examples:
  $ jammin deploy
  $ jammin deploy test-service
`,
  )
  .action(async (serviceName) => {
    const targetLabel = serviceName ?? "project";
    const projectRoot = process.cwd();
    p.intro(`🚀 Deploying ${targetLabel}...`);

    const s = p.spinner();
    s.start("Loading service configuration...");
    const services = await getServiceConfigs(undefined, serviceName);
    s.stop("✅ Configuration loaded");

    s.start("🔨 Building...");
    for (const service of services) {
      await buildService(service, projectRoot);
    }
    s.stop("✅ Building was successful!");

    s.start("Generating Genesis State...");
    const buildOutputs = await loadServices(projectRoot);
    const genesisOutput = "dist/genesis.json";
    await saveStateFile(generateGenesis(buildOutputs), `${projectRoot}/${genesisOutput}`);
    s.stop("✅ Genesis state generated!");

    p.log.info(`Found ${buildOutputs.length} service(s)`);

    p.log.message(`🎁 Generated file: ${genesisOutput}`);

    p.outro("✅ Deployment was successful!");
  });
