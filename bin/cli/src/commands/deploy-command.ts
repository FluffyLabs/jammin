import * as p from "@clack/prompts";
import { bytes } from "@typeberry/lib";
import { Command } from "commander";
import { getJamFiles } from "../../utils/file-utils";
import { generateState, type ServiceBuildOutput, saveStateFile } from "../../utils/genesis-state-generator";
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
  .option("--skip-build", "skip building before deploy")
  .option("--build-config <path>", "path to build config file")
  .addHelpText(
    "after",
    `
Examples:
  $ jammin deploy
  $ jammin deploy test-service --skip-build
  $ jammin deploy --build-config ./my.config.yml
`,
  )
  .action(async (serviceName, options) => {
    const targetLabel = serviceName ?? "project";
    const projectRoot = process.cwd();
    p.intro(`🚀 Deploying ${targetLabel}...`);

    const s = p.spinner();
    const services = await getServiceConfigs(options.buildConfig, serviceName, s);

    if (!options.skipBuild) {
      s.start("🔨 Building...");
      for (const service of services) {
        await buildService(service, projectRoot);
      }
      s.stop("✅ Building was successful!");
    }

    s.start("Generating Genesis State...");

    const jamFiles: string[] = [];
    for (const service of services) {
      // NOTE: Taking only first jam blob (closest to service path directory)
      // since each service should produce one blob
      // if they produce more its probably for testing purposes
      const jamFile = (await getJamFiles(service.path)).keys().next().value;
      if (jamFile) {
        jamFiles.push(jamFile);
      }
    }

    if (jamFiles.length === 0) {
      throw new DeployError("No JAM files found");
    }

    const buildOutputs: ServiceBuildOutput[] = await Promise.all(
      jamFiles.map(async (file, index) => ({
        id: index,
        code: bytes.BytesBlob.blobFrom(await Bun.file(file).bytes()),
      })),
    );

    const genesisOutput = `${projectRoot}/genesis.json`;
    await saveStateFile(generateState(buildOutputs), genesisOutput);

    s.stop("✅ Genesis state generated!");

    p.log.info(`Found ${buildOutputs.length} service(s)`);

    p.note(`🎁 Genesis file: ${genesisOutput}`);

    p.outro("✅ Deployment was successful!");
  });
