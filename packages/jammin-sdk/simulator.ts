import type { EntropyHash, TimeSlot } from "@typeberry/lib/block";
import * as jamBlock from "@typeberry/lib/block";
import * as jamCodec from "@typeberry/lib/codec";
import * as jamCollections from "@typeberry/lib/collections";
import { type ChainSpec, PvmBackend, tinyChainSpec } from "@typeberry/lib/config";
import * as jamCrypto from "@typeberry/lib/crypto";
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
  /** Chain specification (default: tinyChainSpec) */
  chainSpec?: ChainSpec;

  /** Time slot for the guarantee (default: 0) */
  slot?: TimeSlot;

  /**
   * Number of credentials to generate
   * Default: min(chainSpec.thirdOfValidators, 3)
   * Must be 2 or 3 for consensus requirements
   */
  credentialCount?: number;

  /** Starting validator index to use (default: 0) */
  startValidatorIndex?: number;
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
 * @internal
 */
async function generateValidatorKeyPair(validatorIndex: number, blake2b: Blake2b) {
  const seed = jamCrypto.keyDerivation.trivialSeed(jamNumbers.tryAsU32(validatorIndex));
  const ed25519SecretSeed = jamCrypto.keyDerivation.deriveEd25519SecretKey(seed, blake2b);

  // Create key pair from the secret seed
  // Cast to Bytes<32> since the secret seed is already a 32-byte value
  const keyPair = await jamCrypto.ed25519.privateKey(
    ed25519SecretSeed as Parameters<typeof jamCrypto.ed25519.privateKey>[0],
  );

  return keyPair;
}

/**
 * Create an Ed25519 signature for a work report
 * The signature is over the hash of the work report
 * @internal
 */
async function signWorkReport(
  workReport: WorkReport,
  keyPair: Awaited<ReturnType<typeof generateValidatorKeyPair>>,
  blake2b: Blake2b,
) {
  // Encode the work report to bytes
  const encoder = jamCodec.Encoder.create({ expectedLength: 50000 });
  jamBlock.workReport.WorkReport.Codec.encode(encoder, workReport);
  const encodedBytes = encoder.viewResult();

  // Hash the encoded work report
  const reportHash = blake2b.hashBytes(encodedBytes);

  // Sign the hash
  const signature = await jamCrypto.ed25519.sign(keyPair, reportHash);

  return signature;
}

/**
 * Generate validator guarantees for a work report.
 *
 * Creates credentials from simulated validators to meet consensus requirements.
 * This simulates the dev authorship module where all validators automatically
 * guarantee valid work reports.
 *
 * @param workReport - The work report to generate guarantees for
 * @param options - Configuration options
 * @returns Promise resolving to a ReportGuarantee
 *
 * @example
 * ```typescript
 * import { createWorkReportAsync, generateGuarantees, CoreId, ServiceId, Gas } from "@fluffylabs/jammin-sdk";
 *
 * const report = await createWorkReportAsync({
 *   coreIndex: CoreId(0),
 *   results: [{ serviceId: ServiceId(0), gas: Gas(50000n) }],
 * });
 *
 * // Generate guarantees with default options
 * const guarantee = await generateGuarantees(report);
 *
 * // Generate guarantees with custom options
 * const guarantee2 = await generateGuarantees(report, {
 *   slot: Slot(10),
 *   credentialCount: 3,
 * });
 * ```
 */
export async function generateGuarantees(
  workReport: WorkReport,
  options: GuaranteeOptions = {},
): Promise<jamBlock.guarantees.ReportGuarantee> {
  const chainSpec = options.chainSpec ?? tinyChainSpec;
  const slot = options.slot ?? Slot(0);
  const credentialCount = options.credentialCount ?? Math.min(chainSpec.thirdOfValidators, 3);
  const startValidatorIndex = options.startValidatorIndex ?? 0;

  // Validate credential count
  if (credentialCount < 2 || credentialCount > 3) {
    throw new Error(`Invalid credentialCount: ${credentialCount}. Must be 2 or 3 (required for consensus).`);
  }

  // Validate validator indices are within range
  const maxValidatorIndex = startValidatorIndex + credentialCount - 1;
  if (maxValidatorIndex >= chainSpec.validatorsCount) {
    throw new Error(
      `Validator index ${maxValidatorIndex} exceeds chain spec validator count ${chainSpec.validatorsCount}`,
    );
  }

  const blake2b = await Blake2b.createHasher();

  const credentials: jamBlock.guarantees.Credential[] = [];

  // Generate credentials from N consecutive validators
  for (let i = 0; i < credentialCount; i++) {
    const validatorIndexNum = startValidatorIndex + i;
    const validatorIndex = jamBlock.tryAsValidatorIndex(validatorIndexNum);

    // Generate deterministic keys for this validator
    const keyPair = await generateValidatorKeyPair(validatorIndexNum, blake2b);

    // Sign the work report
    const signature = await signWorkReport(workReport, keyPair, blake2b);

    credentials.push(
      jamBlock.guarantees.Credential.create({
        validatorIndex,
        signature,
      }),
    );
  }

  // Credentials are already sorted by validator index (created in order)

  return jamBlock.guarantees.ReportGuarantee.create({
    report: workReport,
    slot,
    credentials: jamCollections.asKnownSize(credentials),
  });
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
