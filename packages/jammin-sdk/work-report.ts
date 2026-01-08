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

type OpaqueHash = h.OpaqueHash;

/**
 * Converts Uint8Array to 32 byte size hash or zero_hash if given undefined.
 */
function toHash(hash?: Uint8Array): OpaqueHash {
  return hash !== undefined ? bytes.Bytes.fromBlob(hash, 32) : h.ZERO_HASH;
}

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
 * Computes Blake2b hash of the given data.
 */
async function hashData(data: Uint8Array): Promise<OpaqueHash> {
  const hasher = await h.Blake2b.createHasher();
  return hasher.hashBytes(data);
}

/**
 * Creates a WorkResult representing the outcome of a work item execution.
 */
export async function createWorkResult(options: {
  serviceId: number;
  codeHash?: Uint8Array;
  payload?: Uint8Array;
  gas?: bigint;
  output?: Uint8Array;
  isError?: boolean;
  load?: Partial<WorkRefineLoad>;
}): Promise<WorkResult> {
  const payloadHash = await hashData(options.payload ?? new Uint8Array());
  const result = options.isError
    ? { kind: ResultKind.panic, okBlob: null }
    : { kind: ResultKind.ok, okBlob: bytes.BytesBlob.blobFrom(options.output ?? new Uint8Array()) };
  return {
    serviceId: block.tryAsServiceId(options.serviceId),
    codeHash: toHash(options.codeHash).asOpaque(),
    payloadHash: payloadHash,
    gas: block.tryAsServiceGas(options.gas ?? 0),
    result,
    load: createRefineLoad(options.load ?? {}),
  };
}

/**
 * Creates a RefineContext specifying the blockchain state context for work package execution.
 */
export function createRefineContext(options: {
  anchor?: Uint8Array;
  stateRoot?: Uint8Array;
  beefyRoot?: Uint8Array;
  lookupAnchor?: Uint8Array;
  lookupAnchorSlot?: number;
  prerequisites?: Uint8Array[];
}): RefineContext {
  const prerequisites = options.prerequisites !== undefined ? options.prerequisites.map(toHash) : [];
  return {
    anchor: toHash(options.anchor).asOpaque(),
    stateRoot: toHash(options.stateRoot).asOpaque(),
    beefyRoot: toHash(options.beefyRoot).asOpaque(),
    lookupAnchor: toHash(options.lookupAnchor).asOpaque(),
    lookupAnchorSlot: block.tryAsTimeSlot(options.lookupAnchorSlot ?? 0),
    prerequisites: prerequisites.map((hash) => hash.asOpaque()),
  };
}

/**
 * Creates a WorkPackageSpec describing the specification of a work package.
 */
export function createWorkPackageSpec(options: {
  hash?: Uint8Array;
  length?: number;
  erasureRoot?: Uint8Array;
  exportsRoot?: Uint8Array;
  exportsCount?: number;
}): WorkPackageSpec {
  return {
    hash: toHash(options.hash).asOpaque(),
    length: numbers.tryAsU32(options.length ?? 0),
    erasureRoot: toHash(options.erasureRoot).asOpaque(),
    exportsRoot: toHash(options.exportsRoot).asOpaque(),
    exportsCount: numbers.tryAsU16(options.exportsCount ?? 0),
  };
}

/**
 * Creates a complete WorkReport for work package accumulation.
 * This is the main entry point for constructing work reports to submit to the chain.
 */
export async function createWorkReport(options: {
  workPackageSpec?: Parameters<typeof createWorkPackageSpec>[0];
  context?: Parameters<typeof createRefineContext>[0];
  coreIndex?: number;
  authorizerHash?: Uint8Array;
  authorizationOutput?: Uint8Array;
  segmentRootLookup?: WorkPackageInfo[];
  results: Parameters<typeof createWorkResult>[0][];
  authorizationGasUsed?: bigint;
}): Promise<WorkReport> {
  const results = await Promise.all(options.results.map((result) => createWorkResult(result)));

  return {
    workPackageSpec: createWorkPackageSpec(options.workPackageSpec ?? {}),
    context: createRefineContext(options.context ?? {}),
    coreIndex: block.tryAsCoreIndex(options.coreIndex ?? 0),
    authorizerHash: toHash(options.authorizerHash).asOpaque(),
    authorizationOutput: options.authorizationOutput
      ? bytes.BytesBlob.blobFrom(options.authorizationOutput)
      : bytes.BytesBlob.blobFrom(new Uint8Array(0)),
    segmentRootLookup: options.segmentRootLookup ?? [],
    results: collections.FixedSizeArray.new(results, block.workPackage.tryAsWorkItemsCount(results.length)),
    authorizationGasUsed: block.tryAsServiceGas(options.authorizationGasUsed ?? 0),
  };
}
