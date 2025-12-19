import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

const TEST_TMP_DIR = resolve(process.cwd(), ".test");
const PROJECT_NAME = "e2e-test-project";
const PROJECT_PATH = join(TEST_TMP_DIR, PROJECT_NAME);
const CLI_PATH = resolve(process.cwd(), "bin/cli/index.ts");
const TIMEOUT = 120000;

describe("create -> build -> test", () => {
  beforeAll(async () => {
    await mkdir(TEST_TMP_DIR, { recursive: true });
  });

  afterAll(async () => {
    try {
      await rm(TEST_TMP_DIR, { recursive: true, force: true });
    } catch {}
  });

  test.skip( // todo [seko] unskip when docker images are available on CI
    "should create project, build, and test successfully",
    async () => {
      // 'jammin create'
      const createProc = Bun.spawn(["bun", "run", CLI_PATH, "create", PROJECT_NAME, "--template", "undecided"], {
        cwd: TEST_TMP_DIR,
        stdout: "inherit",
        stderr: "inherit",
      });

      const [createOutput, createExitCode] = await Promise.all([
        new Response(createProc.stdout).text(),
        createProc.exited,
      ]);

      if (createExitCode !== 0) {
        const stderr = await new Response(createProc.stderr).text();
        throw new Error(
          `'jammin create' failed with exit code ${createExitCode}\nSTDOUT: ${createOutput}\nSTDERR: ${stderr}`,
        );
      }

      expect(createExitCode).toBe(0);

      // 'jammin build'
      const buildProc = Bun.spawn(["bun", "run", CLI_PATH, "build"], {
        cwd: PROJECT_PATH,
        stdout: "inherit",
        stderr: "inherit",
      });

      const [buildOutput, buildExitCode] = await Promise.all([new Response(buildProc.stdout).text(), buildProc.exited]);

      if (buildExitCode !== 0) {
        const stderr = await new Response(buildProc.stderr).text();
        throw new Error(
          `'jammin build' failed with exit code ${buildExitCode}\nSTDOUT: ${buildOutput}\nSTDERR: ${stderr}`,
        );
      }

      expect(buildExitCode).toBe(0);

      // 'jammin test'
      const testProc = Bun.spawn(["bun", "run", CLI_PATH, "test"], {
        cwd: PROJECT_PATH,
        stdout: "inherit",
        stderr: "inherit",
      });

      const [testOutput, testExitCode] = await Promise.all([new Response(testProc.stdout).text(), testProc.exited]);

      if (testExitCode !== 0) {
        const stderr = await new Response(testProc.stderr).text();
        throw new Error(
          `'jammin test' failed with exit code ${testExitCode}\nSTDOUT: ${testOutput}\nSTDERR: ${stderr}`,
        );
      }

      expect(testExitCode).toBe(0);
    },
    { timeout: TIMEOUT },
  );
});
