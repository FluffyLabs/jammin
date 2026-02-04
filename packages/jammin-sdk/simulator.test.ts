import { beforeAll, describe, expect, test } from "bun:test";
import * as config from "@typeberry/lib/config";
import { generateGuarantees, TestJam } from "./simulator.js";
import { CoreId, Gas, ServiceId, Slot } from "./types.js";
import { createWorkReportAsync } from "./work-report.js";

describe("simulateAccumulation", () => {
  let jam: TestJam;

  beforeAll(() => {
    jam = TestJam.empty();
  });

  test("simulates accumulation with minimal configuration", async () => {
    const report = await createWorkReportAsync({
      results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
    });

    const result = await jam.withWorkReport(report).accumulation();

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

    const result = await jam.withWorkReport(report1).withWorkReport(report2).accumulation();

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

    const result = await jam.withWorkReport(report).accumulation();

    expect(result).toBeDefined();
    expect(result.accumulationStatistics.size).toBe(3);
  });

  test("handles empty reports array", async () => {
    const result = await jam.accumulation();

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
      .accumulation();

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
      .accumulation();

    expect(result).toBeDefined();
  });
});

describe("generateGuarantees", () => {
  test("should generate guarantees for a single report", async () => {
    const report = await createWorkReportAsync({
      coreIndex: CoreId(0),
      results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
    });

    const guarantees = await generateGuarantees([report]);

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

    const guarantees = await generateGuarantees([report1, report2]);

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
    });

    expect(Number(guarantees[0]?.slot)).toBe(42);
  });

  test("should have credentials sorted by validator index", async () => {
    const report = await createWorkReportAsync({
      coreIndex: CoreId(0),
      results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
    });

    const guarantees = await generateGuarantees([report]);

    const indices = guarantees[0]?.credentials.map((c) => Number(c.validatorIndex)) ?? [];
    expect(indices[0]).toBeLessThan(indices[1] ?? 0);
    expect(indices[1]).toBeLessThan(indices[2] ?? 0);
  });
});
