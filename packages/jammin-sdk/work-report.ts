import {
  type CoreIndex,
  refineContext,
  type ServiceGas,
  type ServiceId,
  workPackage,
  workReport,
  workResult,
} from "@typeberry/lib/block";
import { BytesBlob } from "@typeberry/lib/bytes";
import type { CodecRecord } from "@typeberry/lib/codec";
import { FixedSizeArray } from "@typeberry/lib/collections";
import { type Blake2b, type Blake2bHash, ZERO_HASH } from "@typeberry/lib/hash";
import { CoreId, Gas, Slot, U8, U16, U32 } from "./types.js";

type RefineContext = ReturnType<typeof refineContext.RefineContext.create>;
type WorkPackageInfo = ReturnType<typeof refineContext.WorkPackageInfo.create>;
type WorkPackageSpec = ReturnType<typeof workReport.WorkPackageSpec.create>;
type WorkReport = ReturnType<typeof workReport.WorkReport.create>;
type WorkRefineLoad = ReturnType<typeof workResult.WorkRefineLoad.create>;
type WorkResult = ReturnType<typeof workResult.WorkResult.create>;

// Re-export types for convenience
export type { RefineContext, WorkPackageInfo, WorkPackageSpec, WorkReport, WorkRefineLoad, WorkResult };

const { WorkExecResult, WorkExecResultKind } = workResult;

/** Work result status types */
export type WorkResultStatus =
  | { type: "ok"; output?: BytesBlob }
  | { type: "panic" }
  | { type: "outOfGas" }
  | { type: "badCode" }
  | { type: "codeOversize" };

/** Configuration for a single work result with optional fields */
export interface WorkResultConfig {
  /** Service ID that executed the work (required) */
  serviceId: ServiceId;
  /** Code hash of the service */
  codeHash?: Blake2bHash;
  /** Input payload for the work item */
  payload?: BytesBlob;
  /** Gas limit allocated for execution */
  gas?: ServiceGas;
  /** Execution result */
  result?: WorkResultStatus;
  /** Refinement load metrics */
  load?: Partial<CodecRecord<WorkRefineLoad>>;
}

/** Configuration for complete work report with optional fields */
export interface WorkReportConfig {
  /** Work package specification - use U32/U16 from types.ts for branded types */
  workPackageSpec?: Partial<CodecRecord<WorkPackageSpec>>;
  /** Blockchain state context - use Slot from types.ts for branded types */
  context?: Partial<CodecRecord<RefineContext>>;
  /** Core index that produced this report */
  coreIndex?: CoreIndex;
  /** Hash of the authorizer code */
  authorizerHash?: Blake2bHash;
  /** Output from authorization check */
  authorizationOutput?: BytesBlob;
  /** Segment root lookup table */
  segmentRootLookup?: WorkPackageInfo[];
  /** Array of work results (required) */
  results: WorkResultConfig[];
  /** Gas used during authorization */
  authorizationGasUsed?: ServiceGas;
}

/**
 * Creates a WorkResult representing the outcome of a work item execution.
 *
 * @param blake2b - Blake2b hasher instance for computing payload hash
 * @param config - Work result configuration
 * @returns WorkResult instance
 *
 * @example
 * ```typescript
 * const result = createWorkResult(blake2b, {
 *   serviceId: 1,
 *   payload: bytes.BytesBlob.blobFromNumbers([1, 2, 3]),
 *   gas: 1000n,
 *   result: { type: "ok", output: bytes.BytesBlob.blobFromNumbers([4, 5, 6]) },
 * });
 * ```
 */
export function createWorkResult(blake2b: Blake2b, config: WorkResultConfig): WorkResult {
  const payloadBlob = config.payload ?? BytesBlob.blobFrom(new Uint8Array());
  const payloadHash = blake2b.hashBytes(payloadBlob);

  const resultStatus = config.result ?? { type: "ok" };
  let execResult: InstanceType<typeof WorkExecResult>;

  switch (resultStatus.type) {
    case "ok":
      execResult = new WorkExecResult(
        WorkExecResultKind.ok,
        resultStatus.output ?? BytesBlob.blobFrom(new Uint8Array()),
      );
      break;
    case "panic":
      execResult = new WorkExecResult(WorkExecResultKind.panic);
      break;
    case "outOfGas":
      execResult = new WorkExecResult(WorkExecResultKind.outOfGas);
      break;
    case "badCode":
      execResult = new WorkExecResult(WorkExecResultKind.badCode);
      break;
    case "codeOversize":
      execResult = new WorkExecResult(WorkExecResultKind.codeOversize);
      break;
  }

  const load = config.load ?? {};

  return workResult.WorkResult.create({
    serviceId: config.serviceId,
    codeHash: (config.codeHash ?? ZERO_HASH).asOpaque(),
    payloadHash,
    gas: config.gas ?? Gas(0n),
    result: execResult,
    load: workResult.WorkRefineLoad.create({
      gasUsed: load.gasUsed ?? Gas(0n),
      importedSegments: load.importedSegments ?? U32(0),
      exportedSegments: load.exportedSegments ?? U32(0),
      extrinsicCount: load.extrinsicCount ?? U32(0),
      extrinsicSize: load.extrinsicSize ?? U32(0),
    }),
  });
}

/**
 * Creates a complete WorkReport for work package accumulation.
 * This is the main entry point for constructing work reports to submit to the chain.
 *
 * @param blake2b - Blake2b hasher instance for hashing work result payloads
 * @param config - Work report configuration
 * @returns WorkReport instance
 * @throws Error if validation fails or results array is empty
 *
 * @example
 * ```typescript
 * const blake2b = await Blake2b.createHasher();
 *
 * const report = createWorkReport(blake2b, {
 *   coreIndex: 5,
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

  const wpSpec = config.workPackageSpec ?? {};
  const ctx = config.context ?? {};

  return workReport.WorkReport.create({
    workPackageSpec: workReport.WorkPackageSpec.create({
      hash: wpSpec.hash ?? ZERO_HASH.asOpaque(),
      length: wpSpec.length ?? U32(0),
      erasureRoot: wpSpec.erasureRoot ?? ZERO_HASH.asOpaque(),
      exportsRoot: wpSpec.exportsRoot ?? ZERO_HASH.asOpaque(),
      exportsCount: wpSpec.exportsCount ?? U16(0),
    }),
    context: refineContext.RefineContext.create({
      anchor: ctx.anchor ?? ZERO_HASH.asOpaque(),
      stateRoot: ctx.stateRoot ?? ZERO_HASH.asOpaque(),
      beefyRoot: ctx.beefyRoot ?? ZERO_HASH.asOpaque(),
      lookupAnchor: ctx.lookupAnchor ?? ZERO_HASH.asOpaque(),
      lookupAnchorSlot: ctx.lookupAnchorSlot ?? Slot(0),
      prerequisites: ctx.prerequisites ?? [],
    }),
    coreIndex: config.coreIndex ?? CoreId(0),
    authorizerHash: (config.authorizerHash ?? ZERO_HASH).asOpaque(),
    authorizationOutput: config.authorizationOutput ?? BytesBlob.blobFrom(new Uint8Array()),
    segmentRootLookup: config.segmentRootLookup ?? [],
    results: FixedSizeArray.new(results, U8(results.length)),
    authorizationGasUsed: config.authorizationGasUsed ?? Gas(0n),
  });
}

/**
 * Async convenience function that creates a Blake2b hasher and builds a WorkReport.
 * Useful for one-off work report creation without managing the hasher instance.
 *
 * @param config - Work report configuration
 * @returns Promise resolving to WorkReport instance
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
  const { Blake2b } = await import("@typeberry/lib/hash");
  const blake2b = await Blake2b.createHasher();
  return createWorkReport(blake2b, config);
}
