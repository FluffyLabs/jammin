import { describe, expect, test } from "bun:test";
import { BytesBlob } from "@typeberry/lib/bytes";
import { generateGenesis, toJip4Schema } from "./genesis-state-generator";
import { ServiceId } from "./types";
import type { ServiceBuildOutput } from "./utils";

describe("genesis-generator", () => {
  const services: ServiceBuildOutput[] = [
    {
      id: ServiceId(42),
      code: BytesBlob.parseBlob(
        "0x5000156a616d2d626f6f7473747261702d7365727669636506302e312e32370a4170616368652d322e30012550617269747920546563686e6f6c6f67696573203c61646d696e407061726974792e696f3e20350028000002000020000800",
      ),
    },
    {
      id: ServiceId(7),
      code: BytesBlob.parseBlob(
        "0x509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f8235742f",
      ),
    },
  ];

  test("should generate genesis file", async () => {
    // when
    const genesis = toJip4Schema(generateGenesis(services));

    // then
    expect(genesis.id).toBe("testnet");
    expect(genesis.bootnodes).toEqual([]);
    expect(genesis.genesis_header).toBeDefined();
    expect(genesis.genesis_state).toBeDefined();
    expect(Array.isArray(genesis.genesis_state)).toBe(true);
    expect(genesis.genesis_state.length).toBeGreaterThan(0);

    const stateValues = genesis.genesis_state.map((entry) => entry[1]);
    const serviceCodeHex = services[0]?.code.toString().substring(2);
    const serviceCodeHex1 = services[1]?.code.toString().substring(2);

    expect(stateValues.some((v) => v?.includes(serviceCodeHex ?? ""))).toBe(true);
    expect(stateValues.some((v) => v?.includes(serviceCodeHex1 ?? ""))).toBe(true);
  });
});
