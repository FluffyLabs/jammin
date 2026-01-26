import type { EntropyHash, TimeSlot } from "@typeberry/lib/block";
import * as jamBlock from "@typeberry/lib/block";
import { Encoder } from "@typeberry/lib/codec";
import { asKnownSize } from "@typeberry/lib/collections";
import { type ChainSpec, PvmBackend, tinyChainSpec } from "@typeberry/lib/config";
import { ed25519, keyDerivation } from "@typeberry/lib/crypto";
import { Blake2b, ZERO_HASH } from "@typeberry/lib/hash";
import * as jamNumbers from "@typeberry/lib/numbers";
import type { State } from "@typeberry/lib/state";
import {
  Accumulate,
  type AccumulateInput,
  type AccumulateResult,
  type AccumulateState,
} from "@typeberry/lib/transition";
import { Slot } from "./types.js";
import type { WorkReport } from "./work-report.js";

// Re-export types for convenience
export type { AccumulateResult, AccumulateState, State };

/**
 * Configuration options for guarantee generation
 */
export interface GuaranteeOptions {
  /** Time slot for the guarantee (default: 0) */
  slot?: TimeSlot;
}

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
 * Generate deterministic Ed25519 key pair for a dev validator
 * Uses trivial seed derivation for testing purposes
 */
async function generateValidatorKeyPair(validatorIndex: number, blake2b: Blake2b): Promise<ed25519.Ed25519Pair> {
  const seed = keyDerivation.trivialSeed(jamNumbers.tryAsU32(validatorIndex));
  const ed25519SecretSeed = keyDerivation.deriveEd25519SecretKey(seed, blake2b);

  return await ed25519.privateKey(ed25519SecretSeed);
}

/**
 * Create an Ed25519 signature for a work report
 * The signature is over the hash of the work report
 */
async function signWorkReport(
  workReport: WorkReport,
  keyPair: Awaited<ed25519.Ed25519Pair>,
  blake2b: Blake2b,
): Promise<ed25519.Ed25519Signature> {
  const reportBlob = Encoder.encodeObject(jamBlock.workReport.WorkReport.Codec, workReport);

  const reportHash = blake2b.hashBytes(reportBlob);

  return await ed25519.sign(keyPair, reportHash);
}

/**
 * Generate validator guarantees for a list of work reports.
 *
 * @example
 * ```typescript
 * const report1 = await createWorkReportAsync({
 *   coreIndex: CoreId(0),
 *   results: [{ serviceId: ServiceId(0), gas: Gas(50000n) }],
 * });
 * const report2 = await createWorkReportAsync({
 *   coreIndex: CoreId(1),
 *   results: [{ serviceId: ServiceId(1), gas: Gas(30000n) }],
 * });
 *
 * // Generate guarantees for multiple reports
 * const guarantees = await generateGuarantees([report1, report2]);
 * ```
 */
export async function generateGuarantees(
  workReports: WorkReport[],
  options: GuaranteeOptions = {},
): Promise<jamBlock.guarantees.ReportGuarantee[]> {
  const slot = options.slot ?? Slot(0);
  const credentialCount = 3;
  const startValidatorIndex = 0;

  const blake2b = await Blake2b.createHasher();

  const guarantees: jamBlock.guarantees.ReportGuarantee[] = [];

  for (const workReport of workReports) {
    const credentials: jamBlock.guarantees.Credential[] = [];

    for (let i = 0; i < credentialCount; i++) {
      const validatorIndexNum = startValidatorIndex + i;
      const validatorIndex = jamBlock.tryAsValidatorIndex(validatorIndexNum);
      const keyPair = await generateValidatorKeyPair(validatorIndexNum, blake2b);
      const signature = await signWorkReport(workReport, keyPair, blake2b);

      credentials.push(
        jamBlock.guarantees.Credential.create({
          validatorIndex,
          signature,
        }),
      );
    }

    guarantees.push(
      jamBlock.guarantees.ReportGuarantee.create({
        report: workReport,
        slot,
        credentials: asKnownSize(credentials),
      }),
    );
  }

  return guarantees;
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
  const isSequential = options.sequential ?? true;
  const slot = options.slot ?? state.timeslot;
  const entropy = options.entropy ?? ZERO_HASH.asOpaque();

  // Configure logging if debug is enabled
  if (options.debug) {
    await enableLogs();
  }

  const blake2b = await Blake2b.createHasher();

  const accumulate = new Accumulate(chainSpec, blake2b, state, {
    pvm: pvmBackend,
    accumulateSequentially: isSequential,
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

async function enableLogs() {
  try {
    const loggerModule = await import("@typeberry/lib/logger");
    if (loggerModule.Logger && loggerModule.Level) {
      loggerModule.Logger.configureAll("info,host-calls=trace,accumulate=trace", loggerModule.Level.LOG, process.cwd());
    }
  } catch {
    console.warn("Warning: Could not configure typeberry logger");
  }
}
