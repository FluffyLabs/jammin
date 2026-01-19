import * as p from "@clack/prompts";
import { generateGenesis, generateServiceOutput, type ServiceBuildOutput, saveStateFile } from "@fluffylabs/jammin-sdk";
import { Command } from "commander";
import { getJamFiles } from "../../utils/file-utils";
import { getServiceConfigs } from "../../utils/get-service-configs";
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
    const services = await getServiceConfigs(undefined, serviceName, s);

    s.start("🔨 Building...");
    for (const service of services) {
      await buildService(service, projectRoot);
    }
    s.stop("✅ Building was successful!");

    s.start("Generating Genesis State...");

    const jamFiles: string[] = [];
    for (const service of services) {
      // NOTE: Taking only first jam blob (closest to service path directory)
      // since each service should produce one blob
      // if they produce more its probably for testing purposes
      const jamFile = (await getJamFiles(service.path)).keys().next().value;
      if (jamFile) {
        jamFiles.push(jamFile);
      } else {
        throw new DeployError(`Cannot find a jam file for ${service.name} service`);
      }
    }

    if (jamFiles.length === 0) {
      throw new DeployError("No JAM files found");
    }

    const buildOutputs: ServiceBuildOutput[] = await Promise.all(
      jamFiles.map(async (file, index) => generateServiceOutput(file, index)),
    );

    const genesisOutput = `${projectRoot}/genesis.json`;
    await saveStateFile(generateGenesis(buildOutputs), genesisOutput);

    s.stop("✅ Genesis state generated!");

    p.log.info(`Found ${buildOutputs.length} service(s)`);

    p.note(`🎁 Genesis file: ${genesisOutput}`);

    p.outro("✅ Deployment was successful!");
  });
