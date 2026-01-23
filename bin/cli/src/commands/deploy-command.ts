import * as p from "@clack/prompts";
import {
  block,
  type codec,
  generateGenesis,
  generateServiceOutput,
  numbers,
  type ServiceBuildOutput,
  saveStateFile,
  type state,
} from "@fluffylabs/jammin-sdk";
import { Command } from "commander";
import type { ServiceAccountInfoConfig } from "../../types/config";
import { loadBuildConfig } from "../../utils/config-loader";
import { getJamFiles } from "../../utils/file-utils";
import { getServiceConfigs } from "../../utils/get-service-configs";
import { buildService } from "./build-command";

export class DeployError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeployError";
  }
}

const accountInfoSchemaMap = new Map<
  string,
  | typeof numbers.tryAsU64
  | typeof block.tryAsServiceGas
  | typeof numbers.tryAsU32
  | typeof block.tryAsTimeSlot
  | typeof block.tryAsServiceId
>([
  ["balance", numbers.tryAsU64],
  ["accumulateMinGas", block.tryAsServiceGas],
  ["onTransferMinGas", block.tryAsServiceGas],
  ["storageUtilisationBytes", numbers.tryAsU64],
  ["gratisStorage", numbers.tryAsU64],
  ["storageUtilisationCount", numbers.tryAsU32],
  ["created", block.tryAsTimeSlot],
  ["lastAccumulation", block.tryAsTimeSlot],
  ["parentService", block.tryAsServiceId],
]);

function accountInfoFromConfig(config: ServiceAccountInfoConfig): Partial<codec.CodecRecord<state.ServiceAccountInfo>> {
  return Object.fromEntries(
    Object.entries(config)
      .filter(([_, value]) => value !== undefined) // note [seko]: important, if undefineds remain they will overwrite default values
      .map(([key, value]) => [key, accountInfoSchemaMap.get(key)?.(value)]),
  );
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

    const serviceJamFiles = new Map<string, string>();
    for (const service of services) {
      // NOTE: Taking only first jam blob (closest to service path directory)
      // since each service should produce one blob
      // if they produce more its probably for testing purposes
      const jamFiles = await getJamFiles(service.path);
      const jamFile = jamFiles.keys().next().value;
      if (!jamFile) {
        throw new DeployError(`Cannot find a jam file for ${service.name} service`);
      }
      serviceJamFiles.set(service.name, jamFile);
    }

    if (serviceJamFiles.size === 0) {
      throw new DeployError("No JAM files found");
    }

    // Get deployment config for services
    const buildConfig = await loadBuildConfig();
    const serviceDeploymentConfigs = buildConfig.deployment?.services ?? {};

    // generate ids avoiding collisions
    const usedIds = new Set<number>();
    for (const service of services) {
      const deploymentConfig = serviceDeploymentConfigs[service.name];
      if (deploymentConfig?.id !== undefined) {
        usedIds.add(deploymentConfig.id);
      }
    }
    let nextAvailableId = 0;
    const getNextAvailableId = () => {
      while (usedIds.has(nextAvailableId)) {
        nextAvailableId++;
      }
      return nextAvailableId++;
    };

    const buildOutputs: ServiceBuildOutput[] = await Promise.all(
      services.map(async (service) => {
        const jamFile = serviceJamFiles.get(service.name);
        if (!jamFile) {
          throw new DeployError(`Jam file not found for service ${service.name}`);
        }

        const deploymentConfig = serviceDeploymentConfigs[service.name];
        const serviceId = deploymentConfig?.id ?? getNextAvailableId();
        const storage = deploymentConfig?.storage;
        const info = deploymentConfig?.info;

        return generateServiceOutput(jamFile, serviceId, storage, accountInfoFromConfig(info ?? {}));
      }),
    );

    const genesisOutput = `${projectRoot}/genesis.json`;
    await saveStateFile(generateGenesis(buildOutputs), genesisOutput);

    s.stop("✅ Genesis state generated!");

    p.log.info(`Found ${buildOutputs.length} service(s)`);

    p.note(`🎁 Genesis file: ${genesisOutput}`);

    p.outro("✅ Deployment was successful!");
  });
