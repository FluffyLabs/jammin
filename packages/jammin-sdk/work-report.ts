import { block, type bytes, collections, hash as h } from "@typeberry/lib";
import { BytesBlob, Gas, U8, U16, U32 } from "./types.js";

const ResultKind = block.workResult.WorkExecResultKind;

type WorkReport = ReturnType<typeof block.workReport.WorkReport.create>;
type WorkPackageSpec = ReturnType<typeof block.workReport.WorkPackageSpec.create>;
type RefineContext = ReturnType<typeof block.refineContext.RefineContext.create>;
type WorkPackageInfo = ReturnType<typeof block.refineContext.WorkPackageInfo.create>;
type WorkResult = ReturnType<typeof block.workResult.WorkResult.create>;
type WorkRefineLoad = ReturnType<typeof block.workResult.WorkRefineLoad.create>;

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
  anchor?: h.Blake2bHash;
  /** State root hash */
  stateRoot?: h.Blake2bHash;
  /** BEEFY root hash */
  beefyRoot?: h.Blake2bHash;
  /** Lookup anchor hash */
  lookupAnchor?: h.Blake2bHash;
  /** Timeslot for lookup anchor */
  lookupAnchorSlot?: number;
  /** Array of prerequisite hashes */
  prerequisites?: h.Blake2bHash[];
}

/** Configuration for work package specification */
export interface WorkPackageSpecConfig {
  /** Work package hash */
  hash?: h.Blake2bHash;
  /** Length of work package in bytes */
  length?: number;
  /** Erasure coding root hash */
  erasureRoot?: h.Blake2bHash;
  /** Exports root hash */
  exportsRoot?: h.Blake2bHash;
  /** Number of exports */
  exportsCount?: number;
}

/** Work result status types for better type safety */
export type WorkResultStatus = { type: "ok"; output?: Uint8Array | bytes.BytesBlob } | { type: "panic" };

/** Configuration for a single work result */
export interface WorkResultConfig {
  /** Service ID that executed the work */
  serviceId: number;
  /** Code hash of the service */
  codeHash?: h.Blake2bHash;
  /** Input payload for the work item */
  payload?: Uint8Array | bytes.BytesBlob;
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
  authorizerHash?: h.Blake2bHash;
  /** Output from authorization check */
  authorizationOutput?: Uint8Array | bytes.BytesBlob;
  /** Segment root lookup table */
  segmentRootLookup?: WorkPackageInfo[];
  /** Array of work results */
  results: WorkResultConfig[];
  /** Gas used during authorization */
  authorizationGasUsed?: number | bigint;
}

/**
 * Builder class for creating WorkReport.
 *
 * @example
 * ```typescript
 * const report = await new WorkReportBuilder()
 *   .withCoreIndex(5)
 *   .withContext({ anchor: anchorHash, lookupAnchorSlot: 42 })
 *   .addResult({ serviceId: 1, gas: 1000n })
 *   .addResult({ serviceId: 2, gas: 2000n })
 *   .build();
 * ```
 */
export class WorkReportBuilder {
  private config: WorkReportConfig = { results: [] };
  private hasher?: h.Blake2b;

  /**
   * Sets the Blake2b hasher instance.
   * If not set, a new hasher will be created automatically when building.
   */
  withHasher(hasher: h.Blake2b): this {
    this.hasher = hasher;
    return this;
  }

  /** Sets the work package specification */
  withWorkPackageSpec(spec: WorkPackageSpecConfig): this {
    this.config.workPackageSpec = spec;
    return this;
  }

  /** Sets the blockchain state context */
  withContext(context: RefineContextConfig): this {
    this.config.context = context;
    return this;
  }

  /** Sets the core index */
  withCoreIndex(coreIndex: number): this {
    this.config.coreIndex = coreIndex;
    return this;
  }

  /** Sets the authorizer hash */
  withAuthorizerHash(hash: h.Blake2bHash | h.OpaqueHash): this {
    this.config.authorizerHash = hash;
    return this;
  }

  /** Sets the authorization output */
  withAuthorizationOutput(output: Uint8Array | bytes.BytesBlob): this {
    this.config.authorizationOutput = output;
    return this;
  }

  /** Sets the authorization gas used */
  withAuthorizationGas(gas: number | bigint): this {
    this.config.authorizationGasUsed = gas;
    return this;
  }

  /** Sets the segment root lookup table */
  withSegmentRootLookup(lookup: WorkPackageInfo[]): this {
    this.config.segmentRootLookup = lookup;
    return this;
  }

  /** Adds a work result to the report */
  addResult(result: WorkResultConfig): this {
    this.config.results.push(result);
    return this;
  }

  /** Builds the final WorkReport */
  async build(): Promise<WorkReport> {
    const hasher = this.hasher ?? (await h.Blake2b.createHasher());
    return createWorkReport(hasher, this.config);
  }

  /** Synchronous build - requires hasher to be set via withHasher() */
  buildSync(): WorkReport {
    if (!this.hasher) {
      throw new Error("Blake2b hasher must be set via withHasher() to use buildSync()");
    }
    return createWorkReport(this.hasher, this.config);
  }
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
export function createWorkResult(blake2b: h.Blake2b, config: WorkResultConfig): WorkResult {
  const payloadBlob = BytesBlob(config.payload);
  const payloadHash = blake2b.hashBytes(payloadBlob);

  const resultStatus = config.result ?? { type: "ok" };
  const execResult =
    resultStatus.type === "panic"
      ? { kind: ResultKind.panic, okBlob: null }
      : {
          kind: ResultKind.ok,
          okBlob: BytesBlob(resultStatus.output),
        };

  return {
    serviceId: block.tryAsServiceId(config.serviceId),
    codeHash: (config.codeHash ?? h.ZERO_HASH).asOpaque(),
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
    anchor: (config.anchor ?? h.ZERO_HASH).asOpaque(),
    stateRoot: (config.stateRoot ?? h.ZERO_HASH).asOpaque(),
    beefyRoot: (config.beefyRoot ?? h.ZERO_HASH).asOpaque(),
    lookupAnchor: (config.lookupAnchor ?? h.ZERO_HASH).asOpaque(),
    lookupAnchorSlot: block.tryAsTimeSlot(config.lookupAnchorSlot ?? 0),
    prerequisites: prerequisites.map((hash) => (hash ?? h.ZERO_HASH).asOpaque()),
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
    hash: (config.hash ?? h.ZERO_HASH).asOpaque(),
    length: U32(config.length ?? 0, "length"),
    erasureRoot: (config.erasureRoot ?? h.ZERO_HASH).asOpaque(),
    exportsRoot: (config.exportsRoot ?? h.ZERO_HASH).asOpaque(),
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
export function createWorkReport(blake2b: h.Blake2b, config: WorkReportConfig): WorkReport {
  if (config.results.length < block.workPackage.MIN_NUMBER_OF_WORK_ITEMS) {
    throw new Error(`WorkReport cannot contain less than ${block.workPackage.MIN_NUMBER_OF_WORK_ITEMS} results`);
  }

  if (config.results.length > block.workPackage.MAX_NUMBER_OF_WORK_ITEMS) {
    throw new Error(`WorkReport cannot contain more than ${block.workPackage.MAX_NUMBER_OF_WORK_ITEMS} results`);
  }

  const results = config.results.map((resultConfig) => createWorkResult(blake2b, resultConfig));

  return {
    workPackageSpec: createWorkPackageSpec(config.workPackageSpec ?? {}),
    context: createRefineContext(config.context ?? {}),
    coreIndex: block.tryAsCoreIndex(config.coreIndex ?? 0),
    authorizerHash: (config.authorizerHash ?? h.ZERO_HASH).asOpaque(),
    authorizationOutput: BytesBlob(config.authorizationOutput),
    segmentRootLookup: config.segmentRootLookup ?? [],
    results: collections.FixedSizeArray.new(results, U8(results.length, "results.length")),
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
  const blake2b = await h.Blake2b.createHasher();
  return createWorkReport(blake2b, config);
}
