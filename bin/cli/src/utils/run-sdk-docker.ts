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

  // Force a docker platform so that the implicit `docker pull` works on hosts
  // whose native arch the image doesn't publish (e.g. amd64-only `jambrains`
  // pulled on Apple Silicon). Defaults to `linux/amd64`; overridable per-SDK
  // via `SdkConfig.platform`. See #111 and `docs/src/requirements.md`.
  const platform = sdk.platform ?? "linux/amd64";
  const dockerArgs = [
    "run",
    "--rm",
    `--platform=${platform}`,
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
