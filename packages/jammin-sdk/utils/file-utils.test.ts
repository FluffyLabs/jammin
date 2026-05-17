import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findConfigFile, updatePackageJson } from "./file-utils";

const TEST_DIR = join(import.meta.dir, "test-files", "update-package-json-test");

describe("updatePackageJson", () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  test("should update package.json name field", async () => {
    const packageJson = {
      name: "jamsdk-example",
      version: "0.0.1",
      authors: ["Fluffy Labs <contact@fluffylabs.dev>"],
    };

    await writeFile(join(TEST_DIR, "package.json"), JSON.stringify(packageJson, null, 2));

    await updatePackageJson(TEST_DIR, { name: "my-awesome-project" });

    const file = Bun.file(join(TEST_DIR, "package.json"));
    const content = await file.text();
    const updated = JSON.parse(content);

    expect(updated.name).toBe("my-awesome-project");
    expect(updated.version).toBe(packageJson.version);
    expect(updated.authors).toEqual(packageJson.authors);
  });

  test("should not fail if package.json doesn't exist", async () => {
    // Should complete without error
    expect(updatePackageJson(TEST_DIR, { name: "my-project" })).resolves.toBeUndefined();
  });
});

describe("findConfigFile", () => {
  let scratchRoot: string;

  beforeEach(async () => {
    scratchRoot = join(tmpdir(), `jammin-find-config-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    // Drop a .git marker at scratchRoot so the search never escapes upwards.
    await mkdir(join(scratchRoot, ".git"), { recursive: true });
  });

  afterEach(async () => {
    await rm(scratchRoot, { recursive: true, force: true });
  });

  test("returns the file path when present in startDir", async () => {
    const target = join(scratchRoot, "jammin.build.yml");
    await writeFile(target, "services: []\n");

    const result = await findConfigFile("jammin.build.yml", scratchRoot);

    expect(result).toBe(target);
  });

  test("walks up to find the file in a parent directory", async () => {
    const target = join(scratchRoot, "jammin.build.yml");
    await writeFile(target, "services: []\n");
    const nested = join(scratchRoot, "a", "b", "c");
    await mkdir(nested, { recursive: true });

    const result = await findConfigFile("jammin.build.yml", nested);

    expect(result).toBe(target);
  });

  test("stops at the .git marker and returns null if not found below it", async () => {
    // File only exists above the scratchRoot's .git boundary — must not be returned.
    const nested = join(scratchRoot, "a");
    await mkdir(nested, { recursive: true });

    const result = await findConfigFile("jammin.build.yml", nested);

    expect(result).toBeNull();
  });

  test("returns null when the file is nowhere in the search path", async () => {
    const result = await findConfigFile("does-not-exist.yml", scratchRoot);

    expect(result).toBeNull();
  });
});
