import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { updatePackageJson } from "./file-utils";

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
