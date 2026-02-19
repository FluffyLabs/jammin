import { describe, expect, test } from "bun:test";
import { Bytes, BytesBlob } from "@typeberry/lib/bytes";
import { HashDictionary } from "@typeberry/lib/collections";
import { Blake2b, HASH_SIZE } from "@typeberry/lib/hash";
import { type StorageKey, tryAsLookupHistorySlots } from "@typeberry/lib/state";
import { asOpaqueType } from "@typeberry/lib/utils";
import { Gas, ServiceId, Slot, U32, U64 } from "../types";
import type { ServiceBuildOutput } from "./generate-service-output";
import { generateGenesis, generateState, toJip4Schema } from "./genesis-state-generator";

const blake2b = await Blake2b.createHasher();

describe("genesis-generator", () => {
  const basicService: ServiceBuildOutput = {
    id: ServiceId(42),
    code: BytesBlob.parseBlob(
      "0x5000156a616d2d626f6f7473747261702d7365727669636506302e312e32370a4170616368652d322e30012550617269747920546563686e6f6c6f67696573203c61646d696e407061726974792e696f3e20350028000002000020000800",
    ),
  };

  const largerCodeService: ServiceBuildOutput = {
    id: ServiceId(7),
    code: BytesBlob.parseBlob(
      "0x509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f82357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f8235742f",
    ),
  };

  describe("generateGenesis", () => {
    test("should generate genesis with basic services", async () => {
      const services = [basicService, largerCodeService];

      const genesis = toJip4Schema(generateGenesis(services));

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

    test("should generate genesis with empty services array", async () => {
      const genesis = toJip4Schema(generateGenesis([]));

      expect(genesis.id).toBe("testnet");
      expect(genesis.genesis_header).toBeDefined();
      expect(genesis.genesis_state).toBeDefined();
    });
  });

  describe("generateState with storage", () => {
    test("should store and retrieve storage items", async () => {
      const storageKey1Str = "key1";
      const storageKey2Str = "key2";
      const storageValue1Str = "value1";
      const storageValue2Str = "value2";

      const storageKey1: StorageKey = asOpaqueType(BytesBlob.blobFromString(storageKey1Str));
      const storageKey2: StorageKey = asOpaqueType(BytesBlob.blobFromString(storageKey2Str));
      const expectedValue1 = BytesBlob.blobFromString(storageValue1Str);
      const expectedValue2 = BytesBlob.blobFromString(storageValue2Str);

      const serviceWithStorage: ServiceBuildOutput = {
        ...basicService,
        id: ServiceId(100),
        storage: {
          [storageKey1Str]: storageValue1Str,
          [storageKey2Str]: storageValue2Str,
        },
      };

      const state = generateState([serviceWithStorage]);

      const service = state.services.get(ServiceId(100));
      expect(service).toBeDefined();

      const retrievedValue1 = service?.getStorage(storageKey1);
      const retrievedValue2 = service?.getStorage(storageKey2);

      expect(retrievedValue1?.toString()).toBe(expectedValue1.toString());
      expect(retrievedValue2?.toString()).toBe(expectedValue2.toString());
    });

    test("should calculate storage utilisation correctly", async () => {
      const serviceWithStorage: ServiceBuildOutput = {
        ...basicService,
        id: ServiceId(102),
        storage: {
          key: "value",
        },
      };

      const state = generateState([serviceWithStorage]);

      const service = state.services.get(ServiceId(102));
      expect(service).toBeDefined();

      const info = service?.getInfo();
      expect(info?.storageUtilisationCount).toBe(U32(3));
      expect(info?.storageUtilisationBytes).toEqual(U64(217));
    });
  });

  describe("generateState with custom service info", () => {
    test("should apply custom balance", async () => {
      const customBalance = U64(5_000_000n);
      const serviceWithInfo: ServiceBuildOutput = {
        ...basicService,
        id: ServiceId(200),
        info: {
          balance: customBalance,
        },
      };

      const state = generateState([serviceWithInfo]);

      const serviceAccount = state.services.get(ServiceId(200));
      expect(serviceAccount).toBeDefined();
      expect(serviceAccount?.getInfo().balance).toEqual(customBalance);
    });

    test("should apply custom gas settings", async () => {
      const customAccumulateGas = Gas(100n);
      const customOnTransferGas = Gas(50n);
      const serviceWithGas: ServiceBuildOutput = {
        ...basicService,
        id: ServiceId(201),
        info: {
          accumulateMinGas: customAccumulateGas,
          onTransferMinGas: customOnTransferGas,
        },
      };

      const state = generateState([serviceWithGas]);

      const serviceAccount = state.services.get(ServiceId(201));
      expect(serviceAccount).toBeDefined();
      expect(serviceAccount?.getInfo().accumulateMinGas).toEqual(customAccumulateGas);
      expect(serviceAccount?.getInfo().onTransferMinGas).toEqual(customOnTransferGas);
    });
  });

  describe("generateState with preimage blobs and preimage requests", () => {
    test("should include additional preimage blobs", async () => {
      const preimageBlob = BytesBlob.parseBlob("0xaabbccdd");
      const preimageHash = blake2b.hashBytes(preimageBlob).asOpaque();

      const serviceWithPreimages: ServiceBuildOutput = {
        ...basicService,
        id: ServiceId(300),
        preimageBlobs: HashDictionary.fromEntries([[preimageHash, preimageBlob]]),
        preimageRequests: new Map([[preimageHash, tryAsLookupHistorySlots([Slot(0)])]]),
      };

      const state = generateState([serviceWithPreimages]);

      expect(state).toBeDefined();
      const serviceAccount = state.services.get(ServiceId(300));
      expect(serviceAccount).toBeDefined();
    });

    test("should handle multiple slots in preimage requests", async () => {
      const preimageBlob = BytesBlob.parseBlob("0x11223344");
      const preimageHash = blake2b.hashBytes(preimageBlob).asOpaque();

      const serviceWithMultiSlots: ServiceBuildOutput = {
        ...basicService,
        id: ServiceId(301),
        preimageBlobs: HashDictionary.fromEntries([[preimageHash, preimageBlob]]),
        preimageRequests: new Map([[preimageHash, tryAsLookupHistorySlots([Slot(0), Slot(1), Slot(2)])]]),
      };

      const state = generateState([serviceWithMultiSlots]);

      expect(state).toBeDefined();
      const serviceAccount = state.services.get(ServiceId(301));
      expect(serviceAccount).toBeDefined();
    });

    test("should throw error when preimage blob is missing for preimage request entry", async () => {
      const missingHash = Bytes.parseBytes(
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        HASH_SIZE,
      ).asOpaque();

      const serviceWithMissingPreimage: ServiceBuildOutput = {
        ...basicService,
        id: ServiceId(302),
        preimageBlobs: HashDictionary.fromEntries([]), // Empty - no preimage for the hash
        preimageRequests: new Map([[missingHash, tryAsLookupHistorySlots([Slot(0)])]]),
      };

      expect(() => generateState([serviceWithMissingPreimage])).toThrow("Preimage blob not found for hash");
    });

    test("should calculate storage utilisation correctly with additional preimages", async () => {
      const preimageBlob = BytesBlob.parseBlob("0xaabbccdd");
      const preimageHash = blake2b.hashBytes(preimageBlob).asOpaque();

      const serviceWithPreimages: ServiceBuildOutput = {
        ...basicService,
        id: ServiceId(303),
        preimageBlobs: HashDictionary.fromEntries([[preimageHash, preimageBlob]]),
        preimageRequests: new Map([[preimageHash, tryAsLookupHistorySlots([Slot(0)])]]),
      };

      const state = generateState([serviceWithPreimages]);

      const service = state.services.get(ServiceId(303));
      expect(service).toBeDefined();

      const info = service?.getInfo();

      expect(info?.storageUtilisationCount).toBe(U32(4));
      expect(info?.storageUtilisationBytes).toEqual(U64(260));
    });
  });
});
