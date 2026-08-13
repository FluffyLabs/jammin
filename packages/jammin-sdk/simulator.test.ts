import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkReport as JamWorkReport, tryAsValidatorIndex } from "@typeberry/lib/block";
import { BytesBlob } from "@typeberry/lib/bytes";
import { Encoder } from "@typeberry/lib/codec";
import * as config from "@typeberry/lib/config";
import { ed25519, initWasm, keyDerivation } from "@typeberry/lib/crypto";
import { Blake2b } from "@typeberry/lib/hash";
import * as jamNumbers from "@typeberry/lib/numbers";
import { SerializedState } from "@typeberry/lib/state-merkleization";
import { type GuaranteeSigner, generateGuarantees, TestJam } from "./simulator.js";
import { counterServiceBytes } from "./test-fixtures/counter-service.js";
import { expectAccumulationSuccess } from "./testing-helpers.js";
import { CoreId, Gas, ServiceId, Slot } from "./types.js";
import { generateGenesis, toJip4Schema } from "./utils/index.js";
import { createWorkReportAsync } from "./work-report.js";

async function createGuaranteeSigners(indices: number[]): Promise<GuaranteeSigner[]> {
  const blake2b = await Blake2b.createHasher();
  return await Promise.all(
    indices.map(async (index) => {
      const seed = keyDerivation.trivialSeed(jamNumbers.tryAsU32(index));
      const secretKey = keyDerivation.deriveEd25519SecretKey(seed, blake2b);
      return {
        validatorIndex: tryAsValidatorIndex(index),
        keyPair: await ed25519.privateKey(secretKey),
      };
    }),
  );
}

describe("simulateAccumulation", () => {
  let jam: TestJam;

  beforeEach(() => {
    jam = TestJam.empty();
  });

  test("simulates accumulation with minimal configuration", async () => {
    const report = await createWorkReportAsync({
      results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
    });

    const result = await jam.withWorkReport(report).accumulate();

    expect(result).toBeDefined();
    expect(result.stateUpdate).toBeDefined();
    expect(result.accumulationStatistics).toBeDefined();
    expect(result.accumulationOutputLog).toBeDefined();
    expect(result.accumulationStatistics.size).toBe(1);
  });

  test("processes multiple work reports", async () => {
    const report1 = await createWorkReportAsync({
      results: [{ serviceId: ServiceId(0), gas: Gas(500n) }],
    });
    const report2 = await createWorkReportAsync({
      results: [{ serviceId: ServiceId(1), gas: Gas(750n) }],
    });

    const result = await jam.withWorkReport(report1).withWorkReport(report2).accumulate();

    expect(result.accumulationStatistics).toBeDefined();
    expect(result.accumulationStatistics.size).toBe(2);
  });

  test("works with work report containing multiple work items", async () => {
    const report = await createWorkReportAsync({
      results: [
        { serviceId: ServiceId(0), gas: Gas(100n), result: { type: "ok" } },
        { serviceId: ServiceId(1), gas: Gas(200n), result: { type: "ok" } },
        { serviceId: ServiceId(2), gas: Gas(300n), result: { type: "panic" } },
      ],
    });

    const result = await jam.withWorkReport(report).accumulate();

    expect(result).toBeDefined();
    expect(result.accumulationStatistics.size).toBe(3);
  });

  test("handles empty reports array", async () => {
    const result = await jam.accumulate();

    expect(result).toBeDefined();
    expect(result.stateUpdate).toBeDefined();
    expect(result.accumulationStatistics.size).toBe(0);
  });

  test("accepts custom slot option", async () => {
    const report = await createWorkReportAsync({
      results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
    });

    const customSlot = Slot(100);
    const result = await jam
      .withWorkReport(report)
      .withOptions({
        slot: customSlot,
      })
      .accumulate();

    expect(result.stateUpdate.timeslot).toBeDefined();
    // The timeslot in the update should be >= the slot we passed
    expect(result.stateUpdate.timeslot).toBeGreaterThanOrEqual(Slot(100));
  });

  test("accepts PVM backend option", async () => {
    const report = await createWorkReportAsync({
      results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
    });

    const result = await jam
      .withWorkReport(report)
      .withOptions({
        pvmBackend: config.PvmBackend.BuiltIn,
      })
      .accumulate();

    expect(result).toBeDefined();
  });
});

describe("generateGuarantees", () => {
  let signers: GuaranteeSigner[];

  beforeAll(async () => {
    await initWasm();
    signers = await createGuaranteeSigners([0, 1, 2]);
  });

  test("should generate guarantees for a single report", async () => {
    const report = await createWorkReportAsync({
      coreIndex: CoreId(0),
      results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
    });

    const guarantees = await generateGuarantees([report], { signers });

    expect(guarantees).toHaveLength(1);
    expect(guarantees[0]?.report).toBe(report);
    expect(guarantees[0]?.credentials.length).toBe(3);
  });

  test("should generate guarantees for multiple reports", async () => {
    const report1 = await createWorkReportAsync({
      coreIndex: CoreId(0),
      results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
    });
    const report2 = await createWorkReportAsync({
      coreIndex: CoreId(1),
      results: [{ serviceId: ServiceId(1), gas: Gas(2000n) }],
    });

    const secondCoreSigners = await createGuaranteeSigners([3, 4, 5]);
    const guarantees = await generateGuarantees([report1, report2], {
      signers: (report) => (report.coreIndex === CoreId(0) ? signers : secondCoreSigners),
    });

    expect(guarantees).toHaveLength(2);
    expect(guarantees[0]?.report).toBe(report1);
    expect(guarantees[1]?.report).toBe(report2);
  });

  test("should generate guarantees with custom slot", async () => {
    const report = await createWorkReportAsync({
      coreIndex: CoreId(0),
      results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
    });

    const guarantees = await generateGuarantees([report], {
      slot: Slot(42),
      signers,
    });

    expect(Number(guarantees[0]?.slot)).toBe(42);
  });

  test("should have credentials sorted by validator index", async () => {
    const report = await createWorkReportAsync({
      coreIndex: CoreId(0),
      results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
    });

    const guarantees = await generateGuarantees([report], { signers: [...signers].reverse() });

    const indices = guarantees[0]?.credentials.map((c) => Number(c.validatorIndex)) ?? [];
    expect(indices[0]).toBeLessThan(indices[1] ?? 0);
    expect(indices[1]).toBeLessThan(indices[2] ?? 0);
  });

  test("signs the domain-separated JAM guarantee payload", async () => {
    const report = await createWorkReportAsync({
      coreIndex: CoreId(0),
      results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
    });
    const [guarantee] = await generateGuarantees([report], { signers });
    const blake2b = await Blake2b.createHasher();
    const reportHash = blake2b.hashBytes(Encoder.encodeObject(JamWorkReport.Codec, report));
    const payload = BytesBlob.blobFromParts(BytesBlob.blobFromString("jam_guarantee").raw, reportHash.raw);
    const keysByIndex = new Map(signers.map((signer) => [signer.validatorIndex, signer.keyPair.pubKey]));
    const credentials = guarantee?.credentials ?? [];
    const verificationInputs = credentials.map((credential) => {
      const key = keysByIndex.get(credential.validatorIndex);
      if (key === undefined) {
        throw new Error(`Missing test key for validator ${credential.validatorIndex}`);
      }
      return {
        signature: credential.signature,
        key,
        message: payload,
      };
    });
    const verification = await ed25519.verify(verificationInputs);
    const bareHashVerification = await ed25519.verify(
      verificationInputs.map((input) => ({
        ...input,
        message: reportHash,
      })),
    );

    expect(verification).toEqual([true, true, true]);
    expect(bareHashVerification).toEqual([false, false, false]);
  });

  test("rejects an invalid signer set", async () => {
    const report = await createWorkReportAsync({
      coreIndex: CoreId(0),
      results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
    });

    await expect(generateGuarantees([report], { signers: signers.slice(0, 1) })).rejects.toThrow(
      "A guarantee requires 2 or 3 signers",
    );
    const duplicateSigner = signers[0];
    if (duplicateSigner === undefined) {
      throw new Error("Expected a guarantee signer fixture");
    }
    await expect(generateGuarantees([report], { signers: [duplicateSigner, duplicateSigner] })).rejects.toThrow(
      "Guarantee signers must have unique validator indices",
    );
  });
});

describe("TestJam factory state shape", () => {
  test("TestJam.empty() holds SerializedState at runtime", () => {
    const jam = TestJam.empty();
    expect(jam.state).toBeInstanceOf(SerializedState);
  });
});

describe("TestJam.fromGenesis", () => {
  // Serialise a JipChainSpec to the JIP-4 JSON shape (hex-encoded keys/values).
  function toJip4Json(genesis: ReturnType<typeof generateGenesis>) {
    return {
      id: genesis.id,
      bootnodes: genesis.bootnodes ?? [],
      genesis_header: genesis.genesisHeader.toString().slice(2),
      genesis_state: Object.fromEntries(
        [...genesis.genesisState.entries()].map(([key, value]) => [key.toString().slice(2), value.toString().slice(2)]),
      ),
    };
  }

  test("loads state from a written genesis.json file", async () => {
    const service = {
      id: ServiceId(7),
      code: BytesBlob.parseBlob("0xdeadbeef"),
    };
    const genesis = generateGenesis([service]);

    const tmpDir = join(tmpdir(), `jammin-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
    const tmpPath = join(tmpDir, "genesis.json");
    await Bun.write(tmpPath, JSON.stringify(toJip4Json(genesis)));

    try {
      const jam = await TestJam.fromGenesis(tmpPath);
      expect(jam.state).toBeInstanceOf(SerializedState);

      const info = jam.getServiceInfo(ServiceId(7));
      expect(info).toBeDefined();
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test("throws a clear error when the genesis file is missing", async () => {
    const missingPath = join(tmpdir(), `definitely-not-here-${Date.now()}.json`);
    await expect(TestJam.fromGenesis(missingPath)).rejects.toThrow(
      `Genesis file not found at ${missingPath}. Run 'jammin deploy' first.`,
    );
  });

  test("accumulate() runs against state loaded from a genesis file", async () => {
    const genesis = generateGenesis([]);
    const tmpDir = join(tmpdir(), `jammin-acc-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
    const tmpPath = join(tmpDir, "genesis.json");
    await Bun.write(tmpPath, JSON.stringify(toJip4Json(genesis)));

    try {
      const jam = await TestJam.fromGenesis(tmpPath);
      const report = await createWorkReportAsync({
        results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
      });

      const result = await jam.withWorkReport(report).accumulate();

      expect(result).toBeDefined();
      expect(result.stateUpdate).toBeDefined();
      expect(result.accumulationStatistics.size).toBe(1);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  test("executes a real PVM service and persists its state update", async () => {
    const serviceId = ServiceId(700);
    const code = BytesBlob.blobFrom(counterServiceBytes());
    const blake2b = await Blake2b.createHasher();
    const genesis = generateGenesis([{ name: "counter", id: serviceId, code }]);
    const tmpDir = join(tmpdir(), `jammin-counter-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
    const tmpPath = join(tmpDir, "genesis.json");
    await Bun.write(tmpPath, JSON.stringify(toJip4Schema(genesis)));

    try {
      const jam = await TestJam.fromGenesis(tmpPath);
      const report = await createWorkReportAsync({
        workPackageSpec: {
          hash: blake2b.hashString("jammin-counter-slot-1").asOpaque(),
        },
        results: [
          {
            serviceId,
            codeHash: blake2b.hashBytes(code),
            gas: Gas(10_000_000n),
          },
        ],
      });

      const result = await jam
        .withOptions({ slot: Slot(1), debug: false })
        .withWorkReport(report)
        .accumulate();
      const statistics = result.accumulationStatistics.get(serviceId);
      const storedCounter = jam.getServiceStorage(serviceId, BytesBlob.blobFromString("cntr"));

      expectAccumulationSuccess(result, { executedServices: [serviceId] });
      expect(statistics?.gasUsed).toBeGreaterThan(0n);
      expect(jam.state.timeslot).toBe(Slot(1));
      expect(storedCounter?.raw).toEqual(Uint8Array.from([1, 0, 0, 0, 0, 0, 0, 0]));
      expect(jam.getServiceInfo(serviceId)?.lastAccumulation).toBe(Slot(1));
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
