import {
  type refineContext,
  tryAsCoreIndex,
  tryAsServiceId,
  tryAsTimeSlot,
  workPackage,
  type workReport,
  workResult,
} from "@typeberry/lib/block";
import type { BytesBlob } from "@typeberry/lib/bytes";
import { FixedSizeArray } from "@typeberry/lib/collections";
import { Blake2b, type Blake2bHash, ZERO_HASH } from "@typeberry/lib/hash";
import { Blob, Gas, U8, U16, U32 } from "./types.js";

const ResultKind = workResult.WorkExecResultKind;

type WorkReport = ReturnType<typeof workReport.WorkReport.create>;
type WorkPackageSpec = ReturnType<typeof workReport.WorkPackageSpec.create>;
type RefineContext = ReturnType<typeof refineContext.RefineContext.create>;
type WorkPackageInfo = ReturnType<typeof refineContext.WorkPackageInfo.create>;
type WorkResult = ReturnType<typeof workResult.WorkResult.create>;
type WorkRefineLoad = ReturnType<typeof workResult.WorkRefineLoad.create>;

/** Configuration for work refinement load metrics */
export interface WorkRefineLoadConfig {
  /** Number of segments exported during execution */
  exportedSegments?: number;
  /** Number of extrinsics processed */
  extrinsicCount?: number;
  /** Total size of extrinsics in bytes */
  extrinsicSize?: number;
  /** Amount of gas consumed */
  gasUsed?: number | bigint;
  /** Number of segments imported during execution */
  importedSegments?: number;
}

/** Configuration for blockchain state context */
export interface RefineContextConfig {
  /** Block hash anchor point */
  anchor?: Blake2bHash;
  /** State root hash */
  stateRoot?: Blake2bHash;
  /** BEEFY root hash */
  beefyRoot?: Blake2bHash;
  /** Lookup anchor hash */
  lookupAnchor?: Blake2bHash;
  /** Timeslot for lookup anchor */
  lookupAnchorSlot?: number;
  /** Array of prerequisite hashes */
  prerequisites?: Blake2bHash[];
}

/** Configuration for work package specification */
export interface WorkPackageSpecConfig {
  /** Work package hash */
  hash?: Blake2bHash;
  /** Length of work package in bytes */
  length?: number;
  /** Erasure coding root hash */
  erasureRoot?: Blake2bHash;
  /** Exports root hash */
  exportsRoot?: Blake2bHash;
  /** Number of exports */
  exportsCount?: number;
}

/** Work result status types for better type safety */
export type WorkResultStatus = { type: "ok"; output?: Uint8Array | BytesBlob } | { type: "panic" };

/** Configuration for a single work result */
export interface WorkResultConfig {
  /** Service ID that executed the work */
  serviceId: number;
  /** Code hash of the service */
  codeHash?: Blake2bHash;
  /** Input payload for the work item */
  payload?: Uint8Array | BytesBlob;
  /** Gas limit allocated for execution */
  gas?: number | bigint;
  /** Execution result (ok with optional output, or panic) */
  result?: WorkResultStatus;
  /** Refinement load metrics */
  load?: WorkRefineLoadConfig;
}

/** Configuration for complete work report */
export interface WorkReportConfig {
  /** Work package specification */
  workPackageSpec?: WorkPackageSpecConfig;
  /** Blockchain state context */
  context?: RefineContextConfig;
  /** Core index that produced this report */
  coreIndex?: number;
  /** Hash of the authorizer code */
  authorizerHash?: Blake2bHash;
  /** Output from authorization check */
  authorizationOutput?: Uint8Array | BytesBlob;
  /** Segment root lookup table */
  segmentRootLookup?: WorkPackageInfo[];
  /** Array of work results */
  results: WorkResultConfig[];
  /** Gas used during authorization */
  authorizationGasUsed?: number | bigint;
}

/**
 * Creates a WorkRefineLoad object with validated numeric types.
 *
 * @param config - Refinement load configuration with all fields optional
 * @returns Validated WorkRefineLoad object
 * @throws Error if any numeric value is out of valid range
 *
 * @example
 * ```typescript
 * const load = createRefineLoad({
 *   exportedSegments: 5,
 *   gasUsed: 1000n,
 * });
 * ```
 */
export function createRefineLoad(config: WorkRefineLoadConfig = {}): WorkRefineLoad {
  return {
    exportedSegments: U32(config.exportedSegments ?? 0, "exportedSegments"),
    extrinsicCount: U32(config.extrinsicCount ?? 0, "extrinsicCount"),
    extrinsicSize: U32(config.extrinsicSize ?? 0, "extrinsicSize"),
    gasUsed: Gas(config.gasUsed ?? 0n, "gasUsed"),
    importedSegments: U32(config.importedSegments ?? 0, "importedSegments"),
  };
}

/**
 * Creates a WorkResult representing the outcome of a work item execution.
 *
 * @param blake2b - Blake2b hasher instance for computing payload hash
 * @param config - Work result configuration
 * @returns Validated WorkResult object
 * @throws Error if validation fails
 *
 * @example
 * ```typescript
 * // Success result
 * const result = createWorkResult(blake2b, {
 *   serviceId: 1,
 *   payload: new Uint8Array([1, 2, 3]),
 *   gas: 1000n,
 *   result: { type: "ok", output: new Uint8Array([4, 5, 6]) },
 * });
 *
 * // Error result
 * const errorResult = createWorkResult(blake2b, {
 *   serviceId: 2,
 *   result: { type: "panic" },
 * });
 * ```
 */
export function createWorkResult(blake2b: Blake2b, config: WorkResultConfig): WorkResult {
  const payloadBlob = Blob(config.payload);
  const payloadHash = blake2b.hashBytes(payloadBlob);

  const resultStatus = config.result ?? { type: "ok" };
  const execResult =
    resultStatus.type === "panic"
      ? { kind: ResultKind.panic, okBlob: null }
      : {
          kind: ResultKind.ok,
          okBlob: Blob(resultStatus.output),
        };

  return {
    serviceId: tryAsServiceId(config.serviceId),
    codeHash: (config.codeHash ?? ZERO_HASH).asOpaque(),
    payloadHash,
    gas: Gas(config.gas ?? 0n, "gas"),
    result: execResult,
    load: createRefineLoad(config.load ?? {}),
  };
}

/**
 * Creates a RefineContext specifying the blockchain state context for work package execution.
 *
 * @param config - Refine context configuration with all fields optional
 * @returns Validated RefineContext object
 * @throws Error if validation fails
 *
 * @example
 * ```typescript
 * const context = createRefineContext({
 *   anchor: anchorHash,
 *   stateRoot: stateRootHash,
 *   lookupAnchorSlot: 42,
 *   prerequisites: [prereq1Hash, prereq2Hash],
 * });
 * ```
 */
export function createRefineContext(config: RefineContextConfig = {}): RefineContext {
  const prerequisites = config.prerequisites ?? [];

  return {
    anchor: (config.anchor ?? ZERO_HASH).asOpaque(),
    stateRoot: (config.stateRoot ?? ZERO_HASH).asOpaque(),
    beefyRoot: (config.beefyRoot ?? ZERO_HASH).asOpaque(),
    lookupAnchor: (config.lookupAnchor ?? ZERO_HASH).asOpaque(),
    lookupAnchorSlot: tryAsTimeSlot(config.lookupAnchorSlot ?? 0),
    prerequisites: prerequisites.map((hash) => (hash ?? ZERO_HASH).asOpaque()),
  };
}

/**
 * Creates a WorkPackageSpec describing the specification of a work package.
 *
 * @param config - Work package specification configuration with all fields optional
 * @returns Validated WorkPackageSpec object
 * @throws Error if validation fails
 *
 * @example
 * ```typescript
 * const spec = createWorkPackageSpec({
 *   hash: packageHash,
 *   length: 1024,
 *   exportsCount: 5,
 * });
 * ```
 */
export function createWorkPackageSpec(config: WorkPackageSpecConfig = {}): WorkPackageSpec {
  return {
    hash: (config.hash ?? ZERO_HASH).asOpaque(),
    length: U32(config.length ?? 0, "length"),
    erasureRoot: (config.erasureRoot ?? ZERO_HASH).asOpaque(),
    exportsRoot: (config.exportsRoot ?? ZERO_HASH).asOpaque(),
    exportsCount: U16(config.exportsCount ?? 0, "exportsCount"),
  };
}

/**
 * Creates a complete WorkReport for work package accumulation.
 * This is the main entry point for constructing work reports to submit to the chain.
 *
 * @param blake2b - Blake2b hasher instance for hashing work result payloads
 * @param config - Work report configuration
 * @returns Validated WorkReport object
 * @throws Error if validation fails or results array is empty
 *
 * @example
 * ```typescript
 * const blake2b = await h.Blake2b.createHasher();
 *
 * const report = createWorkReport(blake2b, {
 *   coreIndex: 5,
 *   context: {
 *     anchor: anchorHash,
 *     lookupAnchorSlot: 42,
 *   },
 *   results: [
 *     { serviceId: 1, gas: 1000n },
 *     { serviceId: 2, gas: 2000n },
 *   ],
 * });
 * ```
 */
export function createWorkReport(blake2b: Blake2b, config: WorkReportConfig): WorkReport {
  if (config.results.length < workPackage.MIN_NUMBER_OF_WORK_ITEMS) {
    throw new Error(`WorkReport cannot contain less than ${workPackage.MIN_NUMBER_OF_WORK_ITEMS} results`);
  }

  if (config.results.length > workPackage.MAX_NUMBER_OF_WORK_ITEMS) {
    throw new Error(`WorkReport cannot contain more than ${workPackage.MAX_NUMBER_OF_WORK_ITEMS} results`);
  }

  const results = config.results.map((resultConfig) => createWorkResult(blake2b, resultConfig));

  return {
    workPackageSpec: createWorkPackageSpec(config.workPackageSpec ?? {}),
    context: createRefineContext(config.context ?? {}),
    coreIndex: tryAsCoreIndex(config.coreIndex ?? 0),
    authorizerHash: (config.authorizerHash ?? ZERO_HASH).asOpaque(),
    authorizationOutput: Blob(config.authorizationOutput),
    segmentRootLookup: config.segmentRootLookup ?? [],
    results: FixedSizeArray.new(results, U8(results.length, "results.length")),
    authorizationGasUsed: Gas(config.authorizationGasUsed ?? 0n, "authorizationGasUsed"),
  };
}

/**
 * Async convenience function that creates a Blake2b hasher and builds a WorkReport.
 * Useful for one-off work report creation without managing the hasher instance.
 *
 * @param config - Work report configuration
 * @returns Promise resolving to validated WorkReport object
 *
 * @example
 * ```typescript
 * const report = await createWorkReportAsync({
 *   coreIndex: 5,
 *   results: [{ serviceId: 1, gas: 1000n }],
 * });
 * ```
 */
export async function createWorkReportAsync(config: WorkReportConfig): Promise<WorkReport> {
  const blake2b = await Blake2b.createHasher();
  return createWorkReport(blake2b, config);
}
