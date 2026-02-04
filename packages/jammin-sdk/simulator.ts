import * as jamBlock from "@typeberry/lib/block";
import { Credential, type EntropyHash, ReportGuarantee, type TimeSlot } from "@typeberry/lib/block";
import type { BytesBlob } from "@typeberry/lib/bytes";
import { Encoder } from "@typeberry/lib/codec";
import { asKnownSize } from "@typeberry/lib/collections";
import { type ChainSpec, PvmBackend, tinyChainSpec } from "@typeberry/lib/config";
import { ed25519, keyDerivation } from "@typeberry/lib/crypto";
import { Blake2b, type OpaqueHash, ZERO_HASH } from "@typeberry/lib/hash";
import * as jamNumbers from "@typeberry/lib/numbers";
import { InMemoryState, type LookupHistorySlots, type ServiceAccountInfo, type State } from "@typeberry/lib/state";
import { type SerializedState, type StateEntries, serializeStateUpdate } from "@typeberry/lib/state-merkleization";
import {
  Accumulate,
  type AccumulateInput,
  type AccumulateResult,
  type AccumulateState,
} from "@typeberry/lib/transition";
import { asOpaqueType } from "@typeberry/lib/utils";
import { generateState } from "./genesis-state-generator.js";
import { Slot } from "./types.js";
import { loadServices } from "./utils/generate-service-output.js";
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
  const reportBlob = Encoder.encodeObject(jamBlock.WorkReport.Codec, workReport);

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
): Promise<ReportGuarantee[]> {
  const slot = options.slot ?? Slot(0);
  const credentialCount = 3;
  const startValidatorIndex = 0;

  const blake2b = await Blake2b.createHasher();

  const guarantees: ReportGuarantee[] = [];

  for (const workReport of workReports) {
    const credentials: Credential[] = [];

    for (let i = 0; i < credentialCount; i++) {
      const validatorIndexNum = startValidatorIndex + i;
      const validatorIndex = jamBlock.tryAsValidatorIndex(validatorIndexNum);
      const keyPair = await generateValidatorKeyPair(validatorIndexNum, blake2b);
      const signature = await signWorkReport(workReport, keyPair, blake2b);

      credentials.push(
        Credential.create({
          validatorIndex,
          signature,
        }),
      );
    }

    guarantees.push(
      ReportGuarantee.create({
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

/**
 * Test helper class for simulating JAM accumulation in Bun tests.
 * Automatically generates state on construction and provides a fluent API
 * for injecting work reports and running accumulation.
 *
 * @example
 * ```typescript
 * // Create a test instance with loaded services
 * const jam = await TestJam.create();
 *
 * // Create and submit a work report
 * const report = await createWorkReportAsync({
 *   results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
 * });
 * const result = await jam.withWorkReport(report).accumulation();
 *
 * // Chain multiple work reports
 * const result2 = await jam
 *   .withWorkReport(report1)
 *   .withWorkReport(report2)
 *   .withOptions({ debug: true })
 *   .accumulation();
 *
 * // Query service state after accumulation
 * const serviceInfo = jam.getServiceInfo(ServiceId(0));
 * ```
 */
export class TestJam {
  public readonly state: InMemoryState | SerializedState<StateEntries>;
  private workReports: WorkReport[] = [];
  private options: SimulatorOptions = {};
  private blake2b?: Blake2b;

  private constructor(state: InMemoryState | SerializedState<StateEntries>) {
    this.state = state;
  }

  /**
   * Create a new TestJam instance with services loaded from the project.
   * This is the recommended way to initialize TestJam for most tests.
   *
   * @returns Promise resolving to a new TestJam instance
   *
   * @example
   * ```typescript
   * const jam = await TestJam.create();
   * ```
   */
  static async create(): Promise<TestJam> {
    const state = generateState(await loadServices());
    return new TestJam(state);
  }

  /**
   * Create a new TestJam instance with empty state (no services).
   * Useful for testing edge cases or when services are not needed.
   *
   * @returns A new TestJam instance with empty state
   *
   * @example
   * ```typescript
   * const jam = TestJam.empty();
   * ```
   */
  static empty(): TestJam {
    const state = generateState([]);
    return new TestJam(state);
  }

  /**
   * Configure simulator options for the next accumulation.
   * Options persist across multiple accumulation() calls until changed.
   *
   * @param options - Simulator configuration options
   * @returns This instance for method chaining
   *
   * @example
   * ```typescript
   * const result = await jam
   *   .withOptions({ debug: true, slot: Slot(100) })
   *   .withWorkReport(report)
   *   .accumulation();
   * ```
   */
  withOptions(options: SimulatorOptions): this {
    this.options = options;
    return this;
  }

  /**
   * Add a work report to be processed in the next accumulation.
   * Multiple work reports can be chained before calling accumulation().
   *
   * @param report - Work report to process
   * @returns This instance for method chaining
   *
   * @example
   * ```typescript
   * const report1 = await createWorkReportAsync({
   *   results: [{ serviceId: ServiceId(0), gas: Gas(1000n) }],
   * });
   * const report2 = await createWorkReportAsync({
   *   results: [{ serviceId: ServiceId(1), gas: Gas(2000n) }],
   * });
   *
   * const result = await jam
   *   .withWorkReport(report1)
   *   .withWorkReport(report2)
   *   .accumulation();
   * ```
   */
  withWorkReport(report: WorkReport): this {
    this.workReports.push(report);
    return this;
  }

  /**
   * Execute accumulation with all queued work reports and apply state changes.
   * Work reports are automatically cleared after accumulation completes.
   *
   * @returns Promise resolving to accumulation result including state updates
   * @throws Error if accumulation fails
   *
   * @example
   * ```typescript
   * const result = await jam.withWorkReport(report).accumulation();
   * console.log(`Processed ${result.accumulationStatistics.size} work items`);
   * ```
   */
  async accumulation(): Promise<AccumulateResult> {
    const result = await simulateAccumulation(this.state, this.workReports, this.options);
    this.workReports = [];
    if (this.state instanceof InMemoryState) {
      this.state.applyUpdate(result);
    } else {
      if (!this.blake2b) {
        this.blake2b = await Blake2b.createHasher();
      }
      if (!this.options.chainSpec) {
        this.options.chainSpec = tinyChainSpec;
      }
      this.state.backend.applyUpdate(serializeStateUpdate(this.options.chainSpec, this.blake2b, result));
    }
    return result;
  }

  /**
   * Get service account information for a specific service ID.
   *
   * @param id - Service ID to query
   * @returns Service account info or undefined if not found
   *
   * @example
   * ```typescript
   * const info = jam.getServiceInfo(ServiceId(0));
   * console.log(`Service balance: ${info?.balance}`);
   * ```
   */
  getServiceInfo(id: jamBlock.ServiceId): ServiceAccountInfo | undefined {
    return this.state.getService(id)?.getInfo();
  }

  /**
   * Get storage value for a specific key in a service's storage.
   *
   * @param id - Service ID
   * @param key - Storage key
   * @returns Storage value, undefined if service not found, null if key not found
   *
   * @example
   * ```typescript
   * const key = BytesBlob.blobFrom(new Uint8Array([1, 2, 3]));
   * const value = jam.getServiceStorage(ServiceId(0), key);
   * ```
   */
  getServiceStorage(id: jamBlock.ServiceId, key: BytesBlob): BytesBlob | undefined | null {
    return this.state.getService(id)?.getStorage(asOpaqueType(key));
  }

  /**
   * Get preimage data for a given hash in a service's preimage store.
   *
   * @param id - Service ID
   * @param hash - Preimage hash
   * @returns Preimage data, undefined if service not found, null if preimage not found
   *
   * @example
   * ```typescript
   * const preimage = jam.getServicePreimage(ServiceId(0), someHash);
   * ```
   */
  getServicePreimage(id: jamBlock.ServiceId, hash: OpaqueHash): BytesBlob | undefined | null {
    return this.state.getService(id)?.getPreimage(hash.asOpaque());
  }

  /**
   * Get preimage lookup history for a given hash in a service's preimage store.
   *
   * @param id - Service ID
   * @param hash - Preimage hash
   * @param len - Length parameter
   * @returns Lookup history, undefined if service not found, null if not found
   *
   * @example
   * ```typescript
   * const history = jam.getServicePreimageLookup(ServiceId(0), someHash, U32(32));
   * ```
   */
  getServicePreimageLookup(
    id: jamBlock.ServiceId,
    hash: OpaqueHash,
    len: jamNumbers.U32,
  ): LookupHistorySlots | undefined | null {
    return this.state.getService(id)?.getLookupHistory(hash.asOpaque(), len);
  }
}
