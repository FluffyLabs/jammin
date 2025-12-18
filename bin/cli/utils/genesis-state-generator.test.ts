import { afterEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { bytes } from "@typeberry/lib";
import { pathExists } from "./file-utils";
import { generateState, type ServiceBuildOutput, saveStateFile } from "./genesis-state-generator";

describe("genesis-generator", () => {
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
    if (await pathExists(outputJsonPath)) {
      //await Bun.file(outputJsonPath).delete();
    }
  });

  test("should generate genesis.json file and save it", async () => {
    // when
    const genesis = generateState(services);
    saveStateFile(genesis, outputJsonPath);

    // then
    expect(genesis.genesisState.size).toBe(22);
    expect(await pathExists(outputJsonPath)).toBe(true);
  });
});
