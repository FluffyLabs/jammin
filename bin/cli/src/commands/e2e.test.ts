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

  test.skip(
    // todo [seko] unskip when docker images are available on CI
    "should create project, build, and test successfully",
    async () => {
      // 'jammin create'
      const createProc = Bun.spawn(["bun", "run", CLI_PATH, "create", PROJECT_NAME, "--template", "undecided"], {
        cwd: TEST_TMP_DIR,
        stdout: "inherit",
        stderr: "inherit",
      });

      const createExitCode = await createProc.exited;
      expect(createExitCode).toBe(0);

      // 'jammin build'
      const buildProc = Bun.spawn(["bun", "run", CLI_PATH, "build"], {
        cwd: PROJECT_PATH,
        stdout: "inherit",
        stderr: "inherit",
      });

      const buildExitCode = await buildProc.exited;
      expect(buildExitCode).toBe(0);

      // 'jammin test'
      const testProc = Bun.spawn(["bun", "run", CLI_PATH, "test"], {
        cwd: PROJECT_PATH,
        stdout: "inherit",
        stderr: "inherit",
      });

      const testExitCode = await testProc.exited;
      expect(testExitCode).toBe(0);
    },
    { timeout: TIMEOUT },
  );
});
