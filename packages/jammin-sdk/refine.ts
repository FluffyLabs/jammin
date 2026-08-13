import { Buffer } from "node:buffer";
import {
  type CoreIndex,
  ImportSpec,
  RefineContext,
  SEGMENT_BYTES,
  type Segment,
  tryAsSegmentIndex,
  tryAsWorkItemsCount,
  WorkItem,
  WorkItemExtrinsicSpec,
  WorkPackage,
  type WorkPackageHash,
  WorkReport,
} from "@typeberry/lib/block";
import { Bytes, BytesBlob } from "@typeberry/lib/bytes";
import { type CodecRecord, Decoder, Encoder } from "@typeberry/lib/codec";
import { asKnownSize, FixedSizeArray } from "@typeberry/lib/collections";
import { type ChainSpec, tinyChainSpec } from "@typeberry/lib/config";
import type { Blake2b, Blake2bHash } from "@typeberry/lib/hash";
import { ZERO_HASH } from "@typeberry/lib/hash";
import { tryAsU16, tryAsU32 } from "@typeberry/lib/numbers";
import type { JamBytes, JamServiceReference } from "./jam-test.js";
import { CoreId, Gas, Slot } from "./types.js";

/** One previously exported segment imported by a Refine work item. */
export interface JamImportSegment {
  treeRoot: Blake2bHash;
  index: number;
}

/** High-level Refine work-item declaration. */
export interface JamWorkItemConfig<ServiceName extends string = string> {
  service: JamServiceReference<ServiceName>;
  payload?: JamBytes;
  refineGas?: number | bigint;
  accumulateGas?: number | bigint;
  imports?: readonly JamImportSegment[];
  extrinsics?: readonly JamBytes[];
  exportCount?: number;
}

/** High-level Refine work-package declaration. */
export interface JamWorkPackageConfig<ServiceName extends string = string> {
  items: readonly JamWorkItemConfig<ServiceName>[];
  authorization?: JamBytes;
  authorizationService?: JamServiceReference<ServiceName>;
  parametrization?: JamBytes;
  context?: Partial<CodecRecord<RefineContext>>;
}

/** Work package plus the out-of-band blobs required to refine it. */
export class JamWorkPackage {
  constructor(
    public readonly value: WorkPackage,
    public readonly hash: WorkPackageHash,
    public readonly extrinsics: readonly BytesBlob[],
  ) {}
}

/** Successful output of a Refine backend. */
export interface JamRefinement {
  readonly report: WorkReport;
  /** Exported segments grouped by the work item that produced them. */
  readonly exports: readonly (readonly Segment[])[];
}

/** Portable backend contract used by {@link refineWorkPackage}. */
export interface JamRefineBackend {
  refine(input: { coreIndex: CoreIndex; workPackage: JamWorkPackage; chainSpec: ChainSpec }): Promise<JamRefinement>;
}

/** Options for executing a work package through a Refine backend. */
export interface JamRefineOptions {
  backend: JamRefineBackend;
  coreIndex?: number | CoreIndex;
  chainSpec?: ChainSpec;
}

/** JSON-RPC transport accepted by {@link TypeberryRpcRefineBackend}. */
export type JamRpcFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/**
 * Refine backend for a running Typeberry node's `typeberry_refineWorkPackage` RPC.
 *
 * Typeberry resolves service code and anchor state locally. Extrinsic blobs are sent
 * alongside the encoded work package, while the returned flat exports are restored
 * to per-work-item segment groups.
 */
export class TypeberryRpcRefineBackend implements JamRefineBackend {
  private requestId = 0;

  constructor(
    private readonly endpoint = "http://127.0.0.1:19800",
    private readonly fetchRpc: JamRpcFetch = fetch,
  ) {}

  async refine(input: {
    coreIndex: CoreIndex;
    workPackage: JamWorkPackage;
    chainSpec: ChainSpec;
  }): Promise<JamRefinement> {
    const encoded = Encoder.encodeObject(WorkPackage.Codec, input.workPackage.value, input.chainSpec);
    const response = await this.fetchRpc(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: ++this.requestId,
        method: "typeberry_refineWorkPackage",
        params: [
          input.coreIndex,
          toBase64(encoded.raw),
          input.workPackage.extrinsics.map((blob) => toBase64(blob.raw)),
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`Typeberry Refine RPC failed with HTTP ${response.status}`);
    }
    const payload: unknown = await response.json();
    const result = parseRpcResult(payload);
    const report = Decoder.decodeObject<WorkReport>(
      WorkReport.Codec,
      BytesBlob.blobFrom(result.report),
      input.chainSpec,
    );
    const exports = splitExports(input.workPackage.value, result.exports);
    return { report, exports };
  }
}

/** Build a protocol-shaped work package and hash its canonical encoding. */
export function createJamWorkPackage<ServiceName extends string>(
  blake2b: Blake2b,
  config: JamWorkPackageConfig<ServiceName>,
  resolve: (service: JamServiceReference<ServiceName>) => {
    id: WorkItem["service"];
    codeHash: Blake2bHash;
  },
  chainSpec: ChainSpec = tinyChainSpec,
): JamWorkPackage {
  if (config.items.length === 0) {
    throw new Error("A work package must contain at least one work item");
  }
  const firstItem = config.items[0];
  if (firstItem === undefined) {
    throw new Error("A work package must contain at least one work item");
  }
  const extrinsics: BytesBlob[] = [];
  const items = config.items.map((item) => {
    const descriptor = resolve(item.service);
    const itemExtrinsics = (item.extrinsics ?? []).map(toBlob);
    extrinsics.push(...itemExtrinsics);
    return WorkItem.create({
      service: descriptor.id,
      codeHash: descriptor.codeHash.asOpaque(),
      payload: item.payload === undefined ? BytesBlob.empty() : toBlob(item.payload),
      refineGasLimit: Gas(item.refineGas ?? 10_000_000n),
      accumulateGasLimit: Gas(item.accumulateGas ?? 10_000_000n),
      importSegments: asKnownSize(
        (item.imports ?? []).map((value) =>
          ImportSpec.create({
            treeRoot: value.treeRoot,
            index: tryAsSegmentIndex(value.index),
          }),
        ),
      ),
      extrinsic: itemExtrinsics.map((blob) =>
        WorkItemExtrinsicSpec.create({
          hash: blake2b.hashBytes(blob).asOpaque(),
          len: tryAsU32(blob.length),
        }),
      ),
      exportCount: tryAsU16(item.exportCount ?? 0),
    });
  });
  const authorization = resolve(config.authorizationService ?? firstItem.service);
  const context = config.context ?? {};
  const workPackage = WorkPackage.create({
    authorization: config.authorization === undefined ? BytesBlob.empty() : toBlob(config.authorization),
    authCodeHost: authorization.id,
    authCodeHash: authorization.codeHash.asOpaque(),
    parametrization: config.parametrization === undefined ? BytesBlob.empty() : toBlob(config.parametrization),
    context: RefineContext.create({
      anchor: context.anchor ?? ZERO_HASH.asOpaque(),
      stateRoot: context.stateRoot ?? ZERO_HASH.asOpaque(),
      beefyRoot: context.beefyRoot ?? ZERO_HASH.asOpaque(),
      lookupAnchor: context.lookupAnchor ?? ZERO_HASH.asOpaque(),
      lookupAnchorSlot: context.lookupAnchorSlot ?? Slot(0),
      prerequisites: context.prerequisites ?? [],
    }),
    items: FixedSizeArray.new(items, tryAsWorkItemsCount(items.length)),
  });
  const encoded = Encoder.encodeObject(WorkPackage.Codec, workPackage, chainSpec);
  return new JamWorkPackage(workPackage, blake2b.hashBytes(encoded).asOpaque(), extrinsics);
}

/** Execute an already built work package using the selected backend. */
export async function refineWorkPackage(
  workPackage: JamWorkPackage,
  options: JamRefineOptions,
): Promise<JamRefinement> {
  return await options.backend.refine({
    coreIndex: typeof options.coreIndex === "number" ? CoreId(options.coreIndex) : (options.coreIndex ?? CoreId(0)),
    workPackage,
    chainSpec: options.chainSpec ?? tinyChainSpec,
  });
}

interface RpcRefineResult {
  report: Uint8Array;
  exports: Uint8Array;
}

function parseRpcResult(payload: unknown): RpcRefineResult {
  if (!isRecord(payload)) {
    throw new Error("Typeberry Refine RPC returned an invalid JSON-RPC response");
  }
  if (isRecord(payload.error)) {
    const message = typeof payload.error.message === "string" ? payload.error.message : "unknown RPC error";
    throw new Error(`Typeberry Refine RPC rejected the work package: ${message}`);
  }
  if (
    !isRecord(payload.result) ||
    typeof payload.result.report !== "string" ||
    typeof payload.result.exports !== "string"
  ) {
    throw new Error("Typeberry Refine RPC returned an invalid result");
  }
  return {
    report: fromBase64(payload.result.report),
    exports: fromBase64(payload.result.exports),
  };
}

function splitExports(workPackage: WorkPackage, raw: Uint8Array): readonly (readonly Segment[])[] {
  const expectedSegments = workPackage.items.reduce((total, item) => total + item.exportCount, 0);
  if (raw.length !== expectedSegments * SEGMENT_BYTES) {
    throw new Error(
      `Typeberry Refine RPC returned ${raw.length} export bytes, expected ${expectedSegments * SEGMENT_BYTES}`,
    );
  }
  let offset = 0;
  return workPackage.items.map((item) =>
    Array.from({ length: item.exportCount }, () => {
      const segment = Bytes.fromBlob(raw.slice(offset, offset + SEGMENT_BYTES), SEGMENT_BYTES);
      offset += SEGMENT_BYTES;
      return segment;
    }),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toBase64(value: Uint8Array): string {
  return Buffer.from(value).toString("base64");
}

function fromBase64(value: string): Uint8Array {
  const normalized = value.replace(/=+$/, "");
  const decoded = Buffer.from(value, "base64");
  if (decoded.toString("base64").replace(/=+$/, "") !== normalized) {
    throw new Error("Typeberry Refine RPC returned invalid Base64 data");
  }
  return Uint8Array.from(decoded);
}

function toBlob(value: JamBytes): BytesBlob {
  if (value instanceof BytesBlob) {
    return value;
  }
  if (typeof value === "string") {
    return BytesBlob.blobFromString(value);
  }
  if (value instanceof Uint8Array) {
    return BytesBlob.blobFrom(value);
  }
  return BytesBlob.blobFromNumbers([...value]);
}
