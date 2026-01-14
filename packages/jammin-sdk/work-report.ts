import { block, bytes, collections, hash as h, numbers } from "@typeberry/lib";
import type {
  RefineContext,
  WorkPackageInfo,
  WorkPackageSpec,
  WorkRefineLoad,
  WorkReport,
  WorkResult,
} from "./types.js";

const ResultKind = block.workResult.WorkExecResultKind;

/**
 * Creates a WorkRefineLoad object with validated numeric types.
 * All fields are optional in the input and default to 0 if not provided.
 */
function createRefineLoad(load: Partial<WorkRefineLoad>): WorkRefineLoad {
  return {
    exportedSegments: numbers.tryAsU32(load.exportedSegments ?? 0),
    extrinsicCount: numbers.tryAsU32(load.extrinsicCount ?? 0),
    extrinsicSize: numbers.tryAsU32(load.extrinsicSize ?? 0),
    gasUsed: block.tryAsServiceGas(load.gasUsed ?? 0),
    importedSegments: numbers.tryAsU32(load.importedSegments ?? 0),
  };
}

/**
 * Creates a WorkResult representing the outcome of a work item execution.
 *
 * @param blake2b - Blake2b hasher instance for computing payload hash
 * @param options - Work result configuration
 */
export function createWorkResult(
  blake2b: h.Blake2b,
  options: {
    serviceId: number;
    codeHash?: h.OpaqueHash;
    payload?: bytes.BytesBlob;
    gas?: bigint;
    output?: bytes.BytesBlob;
    isError?: boolean;
    load?: Partial<WorkRefineLoad>;
  },
): WorkResult {
  const payloadHash = blake2b.hashBytes(options.payload ?? bytes.BytesBlob.blobFrom(new Uint8Array()));
  const result = options.isError
    ? { kind: ResultKind.panic, okBlob: null }
    : { kind: ResultKind.ok, okBlob: options.output ?? bytes.BytesBlob.blobFrom(new Uint8Array()) };
  return {
    serviceId: block.tryAsServiceId(options.serviceId),
    codeHash: options.codeHash?.asOpaque() ?? h.ZERO_HASH.asOpaque(),
    payloadHash: payloadHash,
    gas: block.tryAsServiceGas(options.gas ?? 0),
    result,
    load: createRefineLoad(options.load ?? {}),
  };
}

/**
 * Creates a RefineContext specifying the blockchain state context for work package execution.
 *
 * @param options - Refine context configuration using typeberry types
 */
export function createRefineContext(options: {
  anchor?: h.OpaqueHash;
  stateRoot?: h.OpaqueHash;
  beefyRoot?: h.OpaqueHash;
  lookupAnchor?: h.OpaqueHash;
  lookupAnchorSlot?: number;
  prerequisites?: h.OpaqueHash[];
}): RefineContext {
  return {
    anchor: options.anchor?.asOpaque() ?? h.ZERO_HASH.asOpaque(),
    stateRoot: options.stateRoot?.asOpaque() ?? h.ZERO_HASH.asOpaque(),
    beefyRoot: options.beefyRoot?.asOpaque() ?? h.ZERO_HASH.asOpaque(),
    lookupAnchor: options.lookupAnchor?.asOpaque() ?? h.ZERO_HASH.asOpaque(),
    lookupAnchorSlot: block.tryAsTimeSlot(options.lookupAnchorSlot ?? 0),
    prerequisites: (options.prerequisites ?? []).map((hash) => hash.asOpaque()),
  };
}

/**
 * Creates a WorkPackageSpec describing the specification of a work package.
 *
 * @param options - Work package specification configuration using typeberry types
 */
export function createWorkPackageSpec(options: {
  hash?: h.OpaqueHash;
  length?: number;
  erasureRoot?: h.OpaqueHash;
  exportsRoot?: h.OpaqueHash;
  exportsCount?: number;
}): WorkPackageSpec {
  return {
    hash: options.hash?.asOpaque() ?? h.ZERO_HASH.asOpaque(),
    length: numbers.tryAsU32(options.length ?? 0),
    erasureRoot: options.erasureRoot?.asOpaque() ?? h.ZERO_HASH.asOpaque(),
    exportsRoot: options.exportsRoot?.asOpaque() ?? h.ZERO_HASH.asOpaque(),
    exportsCount: numbers.tryAsU16(options.exportsCount ?? 0),
  };
}

/**
 * Creates a complete WorkReport for work package accumulation.
 * This is the main entry point for constructing work reports to submit to the chain.
 *
 * @param blake2b - Blake2b hasher instance for hashing work result payloads
 * @param options - Work report configuration using typeberry types
 */
export function createWorkReport(
  blake2b: h.Blake2b,
  options: {
    workPackageSpec?: Parameters<typeof createWorkPackageSpec>[0];
    context?: Parameters<typeof createRefineContext>[0];
    coreIndex?: number;
    authorizerHash?: h.OpaqueHash;
    authorizationOutput?: bytes.BytesBlob;
    segmentRootLookup?: WorkPackageInfo[];
    results: Parameters<typeof createWorkResult>[1][];
    authorizationGasUsed?: bigint;
  },
): WorkReport {
  const results = options.results.map((result) => createWorkResult(blake2b, result));
  return {
    workPackageSpec: createWorkPackageSpec(options.workPackageSpec ?? {}),
    context: createRefineContext(options.context ?? {}),
    coreIndex: block.tryAsCoreIndex(options.coreIndex ?? 0),
    authorizerHash: options.authorizerHash?.asOpaque() ?? h.ZERO_HASH.asOpaque(),
    authorizationOutput: options.authorizationOutput ?? bytes.BytesBlob.blobFrom(new Uint8Array(0)),
    segmentRootLookup: options.segmentRootLookup ?? [],
    results: collections.FixedSizeArray.new(results, numbers.tryAsU8(results.length)),
    authorizationGasUsed: block.tryAsServiceGas(options.authorizationGasUsed ?? 0),
  };
}
