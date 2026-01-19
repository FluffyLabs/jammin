import type { EntropyHash, TimeSlot } from "@typeberry/lib/block";
import { type ChainSpec, PvmBackend, tinyChainSpec } from "@typeberry/lib/config";
import { Blake2b, ZERO_HASH } from "@typeberry/lib/hash";
import type { State } from "@typeberry/lib/state";
import {
  Accumulate,
  type AccumulateInput,
  type AccumulateResult,
  type AccumulateState,
} from "@typeberry/lib/transition";
import type { WorkReport } from "./work-report.js";

// Re-export types for convenience
export type { AccumulateResult, AccumulateState, State };

/**
 * Configuration options for the accumulation simulator.
 */
export interface SimulatorOptions {
  /**
   * Chain specification to use for accumulation.
   * Defaults tiny chain spec.
   */
  chainSpec?: ChainSpec;

  /**
   * PVM backend for executing accumulation logic.
   * Defaults to PvmBackend.Ananas (Assembly script interpreter).
   */
  pvmBackend?: PvmBackend;

  /**
   * Time slot for accumulation.
   * Defaults to the state's current timeslot.
   */
  slot?: TimeSlot;

  /**
   * Entropy for accumulation randomness.
   * Defaults to zero hash for deterministic test execution.
   */
  entropy?: EntropyHash;

  /**
   * Use sequential accumulation mode.
   * Defaults to true for predictable test execution.
   */
  sequential?: boolean;

  /**
   * Enable debug logging for accumulation and PVM host calls.
   * Defaults to false.
   */
  debug?: boolean;
}

/**
 * Simulates work report accumulation against a given state.
 */
export async function simulateAccumulation(
  state: State,
  workReports: WorkReport[],
  options: SimulatorOptions = {},
): Promise<AccumulateResult> {
  const chainSpec = options.chainSpec ?? tinyChainSpec;
  const pvmBackend = options.pvmBackend ?? PvmBackend.Ananas;
  const sequential = options.sequential ?? true;
  const slot = options.slot ?? state.timeslot;
  const entropy = options.entropy ?? ZERO_HASH.asOpaque();

  // Configure logging if debug is enabled
  if (options.debug) {
    try {
      const loggerModule = await import("@typeberry/lib/logger");
      if (loggerModule.Logger && loggerModule.Level) {
        loggerModule.Logger.configureAll(
          "info,host-calls=trace,accumulate=trace",
          loggerModule.Level.LOG,
          process.cwd(),
        );
      }
    } catch {
      // Silently ignore if logger configuration fails
      console.warn("Warning: Could not configure typeberry logger");
    }
  }

  const blake2b = await Blake2b.createHasher();

  const accumulate = new Accumulate(chainSpec, blake2b, state, {
    pvm: pvmBackend,
    accumulateSequentially: sequential,
  });

  const input: AccumulateInput = {
    slot,
    reports: workReports,
    entropy,
  };

  // Execute accumulation
  const result = await accumulate.transition(input);

  if (result.isError) {
    throw new Error(`Accumulation failed: ${result.error}`);
  }
  return result.ok;
}
