import { afterEach, describe, expect, test } from "bun:test";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { bytes } from "@typeberry/lib";
import { pathExists } from "./file-utils";
import { loadStateFile, type ServiceBuildOutput, saveStateFile, updateState } from "./state-generator";

describe("genesis-generator", () => {
  const testOutputPath = join(import.meta.dir, "test-files", "base-genesis.json");

  afterEach(async () => {
    const actualOutputPath = join(import.meta.dir, "test-files", "genesis.json");
    if (await pathExists(actualOutputPath)) {
      await unlink(actualOutputPath);
    }
  });

  test("should generate genesis.json with 3 new entries", async () => {
    const service: ServiceBuildOutput = {
      id: 0,
      code: bytes.BytesBlob.parseBlob(
        "0x5000156a616d2d626f6f7473747261702d7365727669636506302e312e32370a4170616368652d322e30012550617269747920546563686e6f6c6f67696573203c61646d696e407061726974792e696f3e20350028000002000020000800",
      ),
    };
    const genesis = await loadStateFile(testOutputPath);
    const prevKeyValuesLength = genesis.state.keyvals.length;

    updateState(genesis, { services: [service] });

    await saveStateFile(genesis, join(import.meta.dir, "test-files"));
    const outputPath = join(import.meta.dir, "test-files", "genesis.json");
    expect(await pathExists(outputPath)).toBe(true);
    expect(genesis.state.keyvals.length).toBe(prevKeyValuesLength + 3);
  });
});
