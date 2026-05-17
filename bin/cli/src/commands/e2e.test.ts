import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

const TEST_TMP_DIR = resolve(process.cwd(), ".test");
const PROJECT_NAME = "e2e-test-project";
const PROJECT_PATH = join(TEST_TMP_DIR, PROJECT_NAME);
const CLI_PATH = resolve(process.cwd(), "bin/cli/index.ts");
// Generous timeout — first run pulls a Docker image and runs a Rust compile inside it.
const TIMEOUT = 600_000;
// The `undecided` template ships one service per supported SDK. We exercise just one to
// keep the test bounded: building all six would multiply runtime and failure surface
// for no extra coverage of the CLI pipeline.
const TARGET_SERVICE = "jade";

async function runCli(args: string[], cwd: string): Promise<void> {
  const proc = Bun.spawn(["bun", "run", CLI_PATH, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    console.error(`jammin ${args.join(" ")} failed (exit ${exitCode})`);
    console.error("STDOUT:", stdout);
    console.error("STDERR:", stderr);
  }
  expect(exitCode).toBe(0);
}

describe("create -> build -> test", () => {
  beforeAll(async () => {
    await mkdir(TEST_TMP_DIR, { recursive: true });
  });

  afterAll(async () => {
    try {
      await rm(TEST_TMP_DIR, { recursive: true, force: true });
    } catch {}
  });

  test(
    "should create project, build, and test successfully",
    async () => {
      await runCli(["create", PROJECT_NAME, "--template", "undecided"], TEST_TMP_DIR);
      await runCli(["build", TARGET_SERVICE], PROJECT_PATH);
      await runCli(["test", TARGET_SERVICE], PROJECT_PATH);
    },
    { timeout: TIMEOUT },
  );
});
