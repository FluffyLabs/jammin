import * as p from "@clack/prompts";
import { Command } from "commander";

const DOCKER_IMAGE = "ghcr.io/fluffylabs/typeberry:latest";

/**
 * Pull the latest Docker image
 */
export async function pullImage(): Promise<void> {
  const proc = Bun.spawn(["docker", "pull", "--platform=linux/amd64", DOCKER_IMAGE], {
    stdout: "pipe",
    stderr: "pipe",
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
export async function startContainer(): Promise<void> {
  const dockerArgs: string[] = ["run", "--rm", "--entrypoint", "/bin/bash", DOCKER_IMAGE, "-c", "npm run tiny-network"];

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

    const s = p.spinner();
    try {
      s.start("Pulling latest Typeberry image...");
      await pullImage();
      s.stop("✅ Image up to date");

      s.start("Spawning Docker container...");
      s.stop("Typeberry container output:");
      await startContainer();

      p.outro("🏁 Local JAM network finished running.");
    } catch (error) {
      if (error instanceof Error) {
        p.log.error(error.message);
      } else {
        p.log.error(String(error));
      }

      p.outro("❌ Start failed. See the output above for details.");
      process.exit(1);
    }
  });
