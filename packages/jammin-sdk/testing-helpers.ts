/**
 * Testing helpers for JAM service development and integration tests.
 * Provides utilities for assertions, state comparisons, and common test patterns.
 *
 * @module testing-helpers
 */

import type { ServiceAccountInfo } from "@typeberry/lib/state";
import type { AccumulateResult } from "@typeberry/lib/transition";

export type { AccumulateResult, AccumulateState, GuaranteeOptions, SimulatorOptions, State } from "./simulator.js";
export { generateGuarantees, simulateAccumulation, TestJam } from "./simulator.js";
export type { WorkReport, WorkReportConfig, WorkResultConfig, WorkResultStatus } from "./work-report.js";
export { createWorkReport, createWorkReportAsync, createWorkResult } from "./work-report.js";

/**
 * Custom error thrown when accumulation assertions fail
 */
export class AccumulationAssertionError extends Error {
  constructor(
    message: string,
    public result: AccumulateResult,
  ) {
    super(message);
    this.name = "AccumulationAssertionError";
  }
}

/**
 * Custom error thrown when state change assertions fail
 */
export class StateChangeAssertionError extends Error {
  constructor(
    message: string,
    public before: unknown,
    public after: unknown,
  ) {
    super(message);
    this.name = "StateChangeAssertionError";
  }
}

/**
 * Assert that accumulation completed successfully without errors.
 * Validates that the accumulation result has the expected structure.
 *
 * @param result - Accumulation result to validate
 * @throws AccumulationAssertionError if accumulation structure is invalid
 *
 * @example
 * ```typescript
 * import { expectAccumulationSuccess } from "@fluffylabs/jammin-sdk/testing-helpers";
 *
 * const jam = await TestJam.create();
 * const report = await createWorkReportAsync({
 *   results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
 * });
 * const result = await jam.withWorkReport(report).accumulate();
 *
 * // Assert accumulation completed
 * expectAccumulationSuccess(result);
 * ```
 */
export function expectAccumulationSuccess(result: AccumulateResult): void {
  if (!result.stateUpdate) {
    throw new AccumulationAssertionError("Accumulation result missing stateUpdate", result);
  }

  if (!result.accumulationStatistics) {
    throw new AccumulationAssertionError("Accumulation result missing accumulationStatistics", result);
  }

  if (!result.accumulationOutputLog) {
    throw new AccumulationAssertionError("Accumulation result missing accumulationOutputLog", result);
  }
}

/**
 * Predicate function for validating state changes.
 * Returns true if the state change is valid, false or throws an error otherwise.
 */
export type StateChangePredicate<T> = (before: T, after: T) => boolean | undefined;

/**
 * Assert that a state change satisfies a given predicate.
 * Useful for validating service state transitions after accumulation.
 *
 * @param before - State before accumulation
 * @param after - State after accumulation
 * @param predicate - Function that validates the state change
 * @param errorMessage - Custom error message if assertion fails
 * @throws StateChangeAssertionError if predicate returns false
 *
 * @example
 * ```typescript
 * import { expectStateChange } from "@fluffylabs/jammin-sdk/testing-helpers";
 *
 * const jam = await TestJam.create();
 * const beforeInfo = jam.getServiceInfo(ServiceId(0));
 *
 * const report = await createWorkReportAsync({
 *   results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
 * });
 * await jam.withWorkReport(report).accumulate();
 *
 * const afterInfo = jam.getServiceInfo(ServiceId(0));
 *
 * // Assert that balance increased
 * expectStateChange(
 *   beforeInfo?.balance,
 *   afterInfo?.balance,
 *   (before, after) => after > before,
 *   "Service balance should increase after work"
 * );
 * ```
 */
export function expectStateChange<T>(
  before: T,
  after: T,
  predicate: StateChangePredicate<T>,
  errorMessage?: string,
): void {
  const result = predicate(before, after);

  // If predicate returns false explicitly, throw error
  if (result === false) {
    throw new StateChangeAssertionError(errorMessage ?? "State change validation failed", before, after);
  }
}

/**
 * Assert that service account information changed as expected.
 * Common use case for validating balance changes, gas refunds, etc.
 *
 * @param before - Service info before accumulation
 * @param after - Service info after accumulation
 * @param predicate - Function that validates the info change
 * @param errorMessage - Custom error message if assertion fails
 * @throws StateChangeAssertionError if predicate returns false
 *
 * @example
 * ```typescript
 * import { expectServiceInfoChange } from "@fluffylabs/jammin-sdk/testing-helpers";
 *
 * const jam = await TestJam.create();
 * const before = jam.getServiceInfo(ServiceId(0));
 *
 * await jam.withWorkReport(report).withOptions({ slot: Slot(100) }).accumulate();
 *
 * const after = jam.getServiceInfo(ServiceId(0));
 *
 * // Validate that gas was consumed
 * expectServiceInfoChange(
 *   before,
 *   after,
 *   (b, a) => {
 *     return a && b && a.lastAccumulation > b.lastAccumulation;
 *   },
 *   "Service should update last accumulation during execution"
 * );
 * ```
 */
export function expectServiceInfoChange(
  before: ServiceAccountInfo | undefined,
  after: ServiceAccountInfo | undefined,
  predicate: StateChangePredicate<ServiceAccountInfo | undefined>,
  errorMessage?: string,
): void {
  expectStateChange(before, after, predicate, errorMessage);
}
