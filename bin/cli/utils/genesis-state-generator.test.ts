import { afterEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { bytes } from "@typeberry/lib";
import { pathExists } from "./file-utils";
import { loadGenesisFile, type ServiceBuildOutput, saveStateFile, updateState } from "./genesis-state-generator";

describe("genesis-generator", () => {
  const baseStatePath = join(import.meta.dir, "test-files", "base-genesis.json");
  const outputPath = join(import.meta.dir, "test-files", "genesis.json");

  afterEach(async () => {
    if (await pathExists(outputPath)) {
      // await Bun.file(outputPath).delete();
    }
  });

  test("should generate genesis.json with 3 new entries", async () => {
    const service: ServiceBuildOutput = {
      id: 42,
      code: bytes.BytesBlob.parseBlob(
        "0x5000156a616d2d626f6f7473747261702d7365727669636506302e312e32370a4170616368652d322e30012550617269747920546563686e6f6c6f67696573203c61646d696e407061726974792e696f3e20350028000002000020000800",
      ),
    };
    const genesis = await loadGenesisFile(baseStatePath);
    const prevKeyValuesLength = genesis.state.keyvals.length;

    updateState(genesis, { services: [service] });

    await saveStateFile(genesis, outputPath);
    expect(await pathExists(outputPath)).toBe(true);
    expect(genesis.state.keyvals.length).toBe(prevKeyValuesLength + 3);
  });
});
