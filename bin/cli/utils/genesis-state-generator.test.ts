import { afterEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { bytes } from "@typeberry/lib";
import { pathExists } from "./file-utils";
import { loadGenesisFile, type ServiceBuildOutput, saveStateFile, updateState } from "./genesis-state-generator";

describe("genesis-generator", () => {
  const baseStateJsonPath = join(import.meta.dir, "test-files", "base-genesis.json");
  const baseStateBinPath = join(import.meta.dir, "test-files", "base-genesis.bin");
  const outputBinPath = join(import.meta.dir, "test-files", "genesis.bin");
  const outputHexPath = join(import.meta.dir, "test-files", "genesis.hex");
  const outputJsonPath = join(import.meta.dir, "test-files", "genesis.json");

  const services: ServiceBuildOutput[] = [
    {
      id: 42,
      code: bytes.BytesBlob.parseBlob(
        "0x5000156a616d2d626f6f7473747261702d7365727669636506302e312e32370a4170616368652d322e30012550617269747920546563686e6f6c6f67696573203c61646d696e407061726974792e696f3e20350028000002000020000800",
      ),
    },
    {
      id: 7,
      code: bytes.BytesBlob.parseBlob(
        "0x509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f8235742f",
      ),
    },
  ];

  afterEach(async () => {
    if (await pathExists(outputBinPath)) {
      await Bun.file(outputBinPath).delete();
    }
    if (await pathExists(outputHexPath)) {
      await Bun.file(outputHexPath).delete();
    }
    if (await pathExists(outputJsonPath)) {
      await Bun.file(outputJsonPath).delete();
    }
  });

  test("should generate genesis.json with new entries and read it", async () => {
    const genesis = await loadGenesisFile(baseStateJsonPath);
    const prevKeyValuesLength = genesis.state.keyvals.length;

    // when
    updateState(genesis, { services: services });

    // then
    await saveStateFile(genesis, outputJsonPath);
    expect(await pathExists(outputJsonPath)).toBe(true);
    expect(genesis.state.keyvals.length).toSatisfy((newKeyValuesLength) => newKeyValuesLength > prevKeyValuesLength);

    const genesisNew = await loadGenesisFile(outputJsonPath);
    expect(genesisNew.state.state_root).toEqual(genesis.state.state_root);
    expect(genesisNew.state.keyvals).toEqual(genesis.state.keyvals);
  });

  test("should generate genesis.bin and read it", async () => {
    const genesis = await loadGenesisFile(baseStateBinPath);

    // when
    updateState(genesis, { services: services });

    // then
    await saveStateFile(genesis, outputBinPath);
    expect(await pathExists(outputBinPath)).toBe(true);

    const genesisNew = await loadGenesisFile(outputBinPath);
    expect(genesisNew.state.state_root).toEqual(genesis.state.state_root);
    expect(genesisNew.state.keyvals).toEqual(genesis.state.keyvals);
  });

  test("should generate genesis.hex and read it", async () => {
    const genesis = await loadGenesisFile(baseStateJsonPath);

    // when
    updateState(genesis, { services: services });

    // then
    await saveStateFile(genesis, outputHexPath);
    expect(await pathExists(outputHexPath)).toBe(true);

    const genesisNew = await loadGenesisFile(outputHexPath);
    expect(genesisNew.state.state_root).toEqual(genesis.state.state_root);
    expect(genesisNew.state.keyvals).toEqual(genesis.state.keyvals);
  });
});
