import { resolve } from "node:path";
import type { ServiceConfig } from "@fluffylabs/jammin-sdk";
import { resolveSdk } from "@fluffylabs/jammin-sdk";

export class DockerError extends Error {
  constructor(
    message: string,
    public output: string,
  ) {
    super(message);
  }
}

export type SdkCommand = "build" | "test";

/**
 * Run an SDK container with either its `build` or `test` command, returning
 * the combined stdout+stderr output. Throws `DockerError` on non-zero exit.
 *
 * The container is always invoked with `--platform=linux/amd64`; see
 * `docs/src/requirements.md` for context.
 */
export async function runSdkDocker(service: ServiceConfig, projectRoot: string, command: SdkCommand): Promise<string> {
  const sdk = resolveSdk(service.sdk);
  const servicePath = resolve(projectRoot, service.path);

  // SDK images currently ship only linux/amd64; force the platform so that the
  // implicit `docker pull` works on Apple Silicon and other arm64 hosts (#111).
  const dockerArgs = [
    "run",
    "--rm",
    "--platform=linux/amd64",
    "-v",
    `${servicePath}:/app`,
    sdk.image,
    ...sdk[command].split(" "),
  ];
  const dockerCommand = `docker ${dockerArgs.join(" ")}`;

  const proc = Bun.spawn(["sh", "-c", `${dockerCommand} 2>&1`], {
    stdout: "pipe",
    stderr: "pipe",
    cwd: projectRoot,
  });

  const [combinedOutput, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);

  if (exitCode !== 0) {
    const verb = command === "build" ? "Build failed" : "Tests failed";
    throw new DockerError(`${verb} for service '${service.name}' with exit code ${exitCode}`, combinedOutput);
  }

  return combinedOutput;
}
