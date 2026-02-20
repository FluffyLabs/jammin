import { access, mkdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import * as p from "@clack/prompts";
import { Command } from "commander";

const DOCKER_IMAGE = "ghcr.io/fluffylabs/typeberry:latest";

// note [seko]: genesis state keys to drop before passing to typeberry. this is needed to avoid overwriting dev node validator data
const GENESIS_STATE_DROP_KEYS: string[] = [
  "04000000000000000000000000000000000000000000000000000000000000", // next validator data
  "07000000000000000000000000000000000000000000000000000000000000", // designated validator data
  "08000000000000000000000000000000000000000000000000000000000000", // current validator data
  "09000000000000000000000000000000000000000000000000000000000000", // previous validator data
];

export async function createFilteredGenesis(genesisPath: string): Promise<string> {
  const raw = await Bun.file(genesisPath).text();
  const genesis = JSON.parse(raw);

  if (genesis.genesis_state && GENESIS_STATE_DROP_KEYS.length > 0) {
    for (const key of GENESIS_STATE_DROP_KEYS) {
      delete genesis.genesis_state[key];
    }
  }

  const tmpPath = join(tmpdir(), `jammin-genesis-${Date.now()}.json`);
  await Bun.write(tmpPath, JSON.stringify(genesis, null, 2));
  return tmpPath;
}

/**
 * Pull the latest Docker image
 */
export async function pullImage(): Promise<void> {
  const proc = Bun.spawn(["docker", "pull", "--platform=linux/amd64", DOCKER_IMAGE], {
    stdout: "inherit",
    stderr: "inherit",
    cwd: process.cwd(),
  });

  const [stderr, exitCode] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);

  if (exitCode !== 0) {
    throw new Error(`Failed to pull image ${DOCKER_IMAGE} with exit code ${exitCode}: ${stderr}`);
  }
}

/**
 * Spawn a Docker container to run a local Typeberry network.
 */
export async function startContainer(filteredGenesisPath: string): Promise<void> {
  const logsPath = `${process.cwd()}/logs`;
  await mkdir(logsPath, { recursive: true });
  const dockerArgs: string[] = [
    "run",
    "--rm",
    "-v",
    `${filteredGenesisPath}:/app/genesis.json:ro`,
    "-v",
    `${logsPath}:/app/bin/jam/logs`,
    "--entrypoint",
    "/bin/bash",
    DOCKER_IMAGE,
    "-c",
    "npm run tiny-network -- --config=dev --config=.chain_spec+=/app/genesis.json",
  ];

  const proc = Bun.spawn(["docker", ...dockerArgs], {
    stdout: "inherit",
    stderr: "inherit",
    cwd: process.cwd(),
  });

  const cleanup = () => {
    proc.kill();
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("exit", cleanup);

  await proc.exited;
}

/**
 * "Start" command definition
 */
export const startCommand = new Command("start")
  .description("start a local JAM environment in a Docker container")
  .addHelpText(
    "after",
    `
Examples:
  $ jammin start
`,
  )
  .action(async () => {
    p.intro("🚀 Starting local JAM network...");

    const genesisPath = resolve(process.cwd(), "dist/genesis.json");
    try {
      await access(genesisPath);
    } catch {
      p.log.error(`Genesis file not found at ${genesisPath}`);
      p.log.info('Run "jammin deploy" first to generate the genesis state.');
      p.outro("❌ Start aborted.");
      process.exit(1);
    }

    let filteredGenesisPath: string | undefined;
    const s = p.spinner();
    try {
      s.start("Pulling latest Typeberry image...");
      await pullImage();
      s.stop("✅ Image up to date");

      s.start("Preparing genesis state...");
      filteredGenesisPath = await createFilteredGenesis(genesisPath);
      s.stop("✅ Genesis state ready");

      s.start("Spawning Docker container...");
      s.stop("Typeberry container output:");
      await startContainer(filteredGenesisPath);

      p.outro("🏁 Local JAM network finished running.");
    } catch (error) {
      if (error instanceof Error) {
        p.log.error(error.message);
      } else {
        p.log.error(String(error));
      }

      p.outro("❌ Start failed. See the output above for details.");
      process.exit(1);
    } finally {
      if (filteredGenesisPath) {
        await unlink(filteredGenesisPath).catch(() => {});
      }
    }
  });
