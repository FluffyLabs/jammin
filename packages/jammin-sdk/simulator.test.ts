import { beforeAll, describe, expect, test } from "bun:test";
import * as config from "@typeberry/lib/config";
import type * as state from "@typeberry/lib/state";
import { generateState } from "./genesis-state-generator.js";
import { simulateAccumulation } from "./simulator.js";
import { Gas, ServiceId, Slot } from "./types.js";
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
