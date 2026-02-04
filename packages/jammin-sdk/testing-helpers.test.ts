import { beforeAll, describe, expect, test } from "bun:test";
import { ZERO_HASH } from "@typeberry/lib/hash";
import { ServiceAccountInfo } from "@typeberry/lib/state";
import {
  expectAccumulationSuccess,
  expectServiceInfoChange,
  expectStateChange,
  generateGuarantees,
  StateChangeAssertionError,
  TestJam,
} from "./testing-helpers.js";
import { CoreId, Gas, ServiceId, Slot, U32, U64 } from "./types.js";
import { createWorkReportAsync } from "./work-report.js";

describe("testing-helpers", () => {
  let jam: TestJam;

  beforeAll(() => {
    jam = TestJam.empty();
  });

  describe("generateGuarantees re-export", () => {
    test("should generate guarantees from testing-helpers", async () => {
      const report = await createWorkReportAsync({
        coreIndex: CoreId(0),
        results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
      });

      const guarantees = await generateGuarantees([report], {
        slot: Slot(42),
      });

      expect(guarantees).toHaveLength(1);
      expect(guarantees[0]?.credentials.length).toBe(3);
    });
  });

  describe("expectAccumulationSuccess", () => {
    test("should pass for valid accumulation result", async () => {
      const report = await createWorkReportAsync({
        results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
      });

      const result = await jam.withWorkReport(report).accumulation();

      // Should not throw
      expectAccumulationSuccess(result);
    });
  });

  describe("expectStateChange", () => {
    test("should pass when predicate returns true", () => {
      expectStateChange(10, 20, (before, after) => after > before);
    });

    test("should pass when predicate returns undefined (no explicit return)", () => {
      // If predicate doesn't return false, it passes
      expectStateChange(10, 20, (_before, _after) => undefined);
    });

    test("should throw when predicate returns false", () => {
      expect(() => {
        expectStateChange(10, 5, (before, after) => after > before, "Should increase");
      }).toThrow(StateChangeAssertionError);
    });

    test("should include custom error message", () => {
      try {
        expectStateChange(10, 5, (before, after) => after > before, "Custom error");
      } catch (e) {
        expect(e).toBeInstanceOf(StateChangeAssertionError);
        expect((e as Error).message).toBe("Custom error");
      }
    });
  });

  describe("expectServiceInfoChange", () => {
    const zeroService = ServiceAccountInfo.create({
      accumulateMinGas: Gas(0),
      balance: U64(0),
      codeHash: ZERO_HASH.asOpaque(),
      created: Slot(0),
      gratisStorage: U64(0),
      lastAccumulation: Slot(0),
      onTransferMinGas: Gas(0),
      parentService: ServiceId(0),
      storageUtilisationBytes: U64(0),
      storageUtilisationCount: U32(0),
    });

    test("should pass when service info predicate is satisfied", () => {
      const before = ServiceAccountInfo.create({ ...zeroService, balance: U64(1000) });
      const after = ServiceAccountInfo.create({ ...zeroService, balance: U64(1500) });

      expectServiceInfoChange(before, after, (b, a) => a && b && a.balance > b.balance, "Balance should increase");
    });

    test("should throw when predicate fails", () => {
      const before = ServiceAccountInfo.create({ ...zeroService, balance: U64(1000) });
      const after = ServiceAccountInfo.create({ ...zeroService, balance: U64(500) });

      expect(() => {
        expectServiceInfoChange(before, after, (b, a) => a && b && a.balance > b.balance, "Balance should increase");
      }).toThrow(StateChangeAssertionError);
    });
  });
});
