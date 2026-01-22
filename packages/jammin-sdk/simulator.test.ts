import { beforeAll, describe, expect, test } from "bun:test";
import * as config from "@typeberry/lib/config";
import type * as state from "@typeberry/lib/state";
import { generateState } from "./genesis-state-generator.js";
import { generateGuarantees, simulateAccumulation } from "./simulator.js";
import { CoreId, Gas, ServiceId, Slot } from "./types.js";
import { createWorkReportAsync } from "./work-report.js";

describe("simulateAccumulation", () => {
  let initialState: state.InMemoryState;

  beforeAll(async () => {
    initialState = generateState([]);
  });

  test("simulates accumulation with minimal configuration", async () => {
    const report = await createWorkReportAsync({
      results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
    });

    const result = await simulateAccumulation(initialState, [report]);

    expect(result).toBeDefined();
    expect(result.stateUpdate).toBeDefined();
    expect(result.accumulationStatistics).toBeDefined();
    expect(result.pendingTransfers).toBeDefined();
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

    const result = await simulateAccumulation(initialState, [report1, report2]);

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

    const result = await simulateAccumulation(initialState, [report], {
      chainSpec: config.tinyChainSpec,
    });

    expect(result).toBeDefined();
    expect(result.accumulationStatistics.size).toBe(3);
  });

  test("handles empty reports array", async () => {
    const result = await simulateAccumulation(initialState, []);

    expect(result).toBeDefined();
    expect(result.stateUpdate).toBeDefined();
    expect(result.accumulationStatistics.size).toBe(0);
  });

  test("accepts custom slot option", async () => {
    const report = await createWorkReportAsync({
      results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
    });

    const customSlot = Slot(100);
    const result = await simulateAccumulation(initialState, [report], {
      slot: customSlot,
    });

    expect(result.stateUpdate.timeslot).toBeDefined();
    // The timeslot in the update should be >= the slot we passed
    expect(result.stateUpdate.timeslot).toBeGreaterThanOrEqual(Slot(100));
  });

  test("accepts PVM backend option", async () => {
    const report = await createWorkReportAsync({
      results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
    });

    const result = await simulateAccumulation(initialState, [report], {
      pvmBackend: config.PvmBackend.BuiltIn,
    });

    expect(result).toBeDefined();
  });
});

describe("generateGuarantees", () => {
  test("should generate guarantees with default options", async () => {
    const report = await createWorkReportAsync({
      coreIndex: CoreId(0),
      results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
    });

    const guarantee = await generateGuarantees(report);

    expect(guarantee).toBeDefined();
    expect(guarantee.report).toBe(report);
    expect(Number(guarantee.slot)).toBe(0); // default
    expect(guarantee.credentials.length).toBe(2); // tinyChainSpec.thirdOfValidators
  });

  test("should generate guarantees with custom slot", async () => {
    const report = await createWorkReportAsync({
      coreIndex: CoreId(0),
      results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
    });

    const guarantee = await generateGuarantees(report, {
      slot: Slot(42),
    });

    expect(Number(guarantee.slot)).toBe(42);
  });

  test("should generate guarantees with credential count of 2", async () => {
    const report = await createWorkReportAsync({
      coreIndex: CoreId(0),
      results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
    });

    const guarantee = await generateGuarantees(report, {
      credentialCount: 2,
    });

    expect(guarantee.credentials.length).toBe(2);
  });

  test("should generate guarantees with credential count of 3", async () => {
    const report = await createWorkReportAsync({
      coreIndex: CoreId(0),
      results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
    });

    const guarantee = await generateGuarantees(report, {
      credentialCount: 3,
    });

    expect(guarantee.credentials.length).toBe(3);
  });

  test("should generate credentials from different validators", async () => {
    const report = await createWorkReportAsync({
      coreIndex: CoreId(0),
      results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
    });

    const guarantee = await generateGuarantees(report, {
      startValidatorIndex: 3,
      credentialCount: 2,
    });

    expect(Number(guarantee.credentials[0]?.validatorIndex)).toBe(3);
    expect(Number(guarantee.credentials[1]?.validatorIndex)).toBe(4);
  });

  test("should sort credentials by validator index", async () => {
    const report = await createWorkReportAsync({
      coreIndex: CoreId(0),
      results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
    });

    const guarantee = await generateGuarantees(report, {
      credentialCount: 3,
    });

    const indices = [
      Number(guarantee.credentials[0]?.validatorIndex ?? 0),
      Number(guarantee.credentials[1]?.validatorIndex ?? 0),
      Number(guarantee.credentials[2]?.validatorIndex ?? 0),
    ];
    expect(indices[0]).toBeLessThan(indices[1]);
    expect(indices[1]).toBeLessThan(indices[2]);
  });

  test("should throw error for invalid credential count", async () => {
    const report = await createWorkReportAsync({
      coreIndex: CoreId(0),
      results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
    });

    await expect(generateGuarantees(report, { credentialCount: 1 })).rejects.toThrow("Invalid credentialCount");

    await expect(generateGuarantees(report, { credentialCount: 4 })).rejects.toThrow("Invalid credentialCount");
  });

  test("should throw error for validator index out of range", async () => {
    const report = await createWorkReportAsync({
      coreIndex: CoreId(0),
      results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
    });

    // tinyChainSpec has 6 validators (indices 0-5)
    await expect(
      generateGuarantees(report, {
        startValidatorIndex: 5,
        credentialCount: 2, // Would need indices 5 and 6, but only 0-5 exist
      }),
    ).rejects.toThrow("exceeds chain spec validator count");
  });

  test("should generate deterministic signatures for same validator", async () => {
    const report = await createWorkReportAsync({
      coreIndex: CoreId(0),
      results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
    });

    const guarantee1 = await generateGuarantees(report, {
      credentialCount: 2,
    });
    const guarantee2 = await generateGuarantees(report, {
      credentialCount: 2,
    });

    // Same validator, same report = same signature
    expect(guarantee1.credentials[0].signature).toEqual(guarantee2.credentials[0].signature);
  });

  test("should generate different signatures for different reports", async () => {
    const report1 = await createWorkReportAsync({
      coreIndex: CoreId(0),
      results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
    });
    const report2 = await createWorkReportAsync({
      coreIndex: CoreId(0),
      results: [{ serviceId: ServiceId(1), gas: Gas(2000n) }],
    });

    const guarantee1 = await generateGuarantees(report1);
    const guarantee2 = await generateGuarantees(report2);

    // Different reports = different signatures
    expect(guarantee1.credentials[0].signature).not.toEqual(guarantee2.credentials[0].signature);
  });

  test("should work with fullChainSpec", async () => {
    const report = await createWorkReportAsync({
      coreIndex: CoreId(0),
      results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
    });

    const guarantee = await generateGuarantees(report, {
      chainSpec: config.fullChainSpec,
      startValidatorIndex: 1000,
      credentialCount: 3,
    });

    expect(guarantee.credentials.length).toBe(3);
    expect(guarantee.credentials[0].validatorIndex).toBe(1000);
    expect(guarantee.credentials[2].validatorIndex).toBe(1002);
  });
});
