import { beforeAll, describe, expect, test } from "bun:test";
import * as bytes from "@typeberry/lib/bytes";
import * as h from "@typeberry/lib/hash";
import { CoreId, Gas, ServiceId, Slot, U16, U32 } from "./types.js";
import { createWorkReport, createWorkReportAsync, createWorkResult } from "./work-report.js";

describe("createWorkResult", () => {
  let blake2b: h.Blake2b;

  beforeAll(async () => {
    blake2b = await h.Blake2b.createHasher();
  });

  test("creates a work result with minimal options", () => {
    const result = createWorkResult(blake2b, {
      serviceId: ServiceId(1),
    });

    expect(result.serviceId).toBe(ServiceId(1));
    expect(result.codeHash).toEqual(h.ZERO_HASH.asOpaque());
    expect(result.gas).toBe(Gas(0n));
    expect(result.result.kind).toBe(0); // ok
    expect(result.result.okBlob).toEqual(bytes.BytesBlob.blobFrom(new Uint8Array()));
  });

  test("creates a work result with all options", () => {
    const codeHash = blake2b.hashBytes(bytes.BytesBlob.blobFromNumbers([1, 2, 3]));
    const payload = bytes.BytesBlob.blobFromNumbers([4, 5, 6]);
    const output = bytes.BytesBlob.blobFromNumbers([7, 8, 9]);

    const result = createWorkResult(blake2b, {
      serviceId: ServiceId(42),
      codeHash,
      payload,
      gas: Gas(1000n),
      result: { type: "ok", output },
      load: {
        exportedSegments: U32(5),
        extrinsicCount: U32(10),
        extrinsicSize: U32(200),
        gasUsed: Gas(500n),
        importedSegments: U32(3),
      },
    });

    expect(result.serviceId).toBe(ServiceId(42));
    expect(result.codeHash).toEqual(codeHash.asOpaque());
    expect(result.gas).toBe(Gas(1000n));
    expect(result.result.kind).toBe(0); // ok
    expect(result.result.okBlob).toEqual(output);
    expect(result.load.exportedSegments).toBe(U32(5));
    expect(result.load.extrinsicCount).toBe(U32(10));
    expect(result.load.extrinsicSize).toBe(U32(200));
    expect(result.load.gasUsed).toBe(Gas(500n));
    expect(result.load.importedSegments).toBe(U32(3));
  });

  test("creates an error result when result type is panic", () => {
    const result = createWorkResult(blake2b, {
      serviceId: ServiceId(1),
      result: { type: "panic" },
    });

    expect(result.result.kind).toBe(2); // panic
    expect(result.result.okBlob).toBeNull();
  });

  test("computes correct payload hash", () => {
    const payload = bytes.BytesBlob.blobFromNumbers([1, 2, 3, 4, 5]);
    const expectedHash = blake2b.hashBytes(payload);

    const result = createWorkResult(blake2b, {
      serviceId: ServiceId(1),
      payload,
    });

    expect(result.payloadHash).toEqual(expectedHash);
  });

  test("handles partial load options with defaults", () => {
    const result = createWorkResult(blake2b, {
      serviceId: ServiceId(1),
      load: {
        exportedSegments: U32(10),
        // Other fields should default to 0
      },
    });

    expect(result.load.exportedSegments).toBe(U32(10));
    expect(result.load.extrinsicCount).toBe(U32(0));
    expect(result.load.extrinsicSize).toBe(U32(0));
    expect(result.load.gasUsed).toBe(Gas(0n));
    expect(result.load.importedSegments).toBe(U32(0));
  });
});

describe("createWorkReport", () => {
  let blake2b: h.Blake2b;

  beforeAll(async () => {
    blake2b = await h.Blake2b.createHasher();
  });

  test("creates a work report with minimal options", () => {
    const report = createWorkReport(blake2b, {
      results: [{ serviceId: ServiceId(1) }],
    });

    expect(report.workPackageSpec.hash).toEqual(h.ZERO_HASH.asOpaque());
    expect(report.context.anchor).toEqual(h.ZERO_HASH.asOpaque());
    expect(report.coreIndex).toBe(CoreId(0));
    expect(report.authorizerHash).toEqual(h.ZERO_HASH.asOpaque());
    expect(report.authorizationOutput).toEqual(bytes.BytesBlob.blobFrom(new Uint8Array(0)));
    expect(report.segmentRootLookup).toEqual([]);
    expect(report.results.length).toBe(1);
    expect(report.authorizationGasUsed).toBe(Gas(0n));
  });

  test("creates a work report with all options", () => {
    const hash = blake2b.hashBytes(bytes.BytesBlob.blobFromNumbers([1]));
    const anchor = blake2b.hashBytes(bytes.BytesBlob.blobFromNumbers([2]));
    const authorizerHash = blake2b.hashBytes(bytes.BytesBlob.blobFromNumbers([3]));
    const authOutput = bytes.BytesBlob.blobFromNumbers([10, 11, 12]);

    const report = createWorkReport(blake2b, {
      workPackageSpec: {
        hash: hash.asOpaque(),
        length: U32(2048),
      },
      context: {
        anchor: anchor.asOpaque(),
        lookupAnchorSlot: Slot(42),
      },
      coreIndex: CoreId(5),
      authorizerHash,
      authorizationOutput: authOutput,
      segmentRootLookup: [],
      results: [
        { serviceId: ServiceId(1), gas: Gas(100n) },
        { serviceId: ServiceId(2), gas: Gas(200n) },
      ],
      authorizationGasUsed: Gas(50n),
    });

    expect(report.workPackageSpec.hash).toEqual(hash.asOpaque());
    expect(report.workPackageSpec.length).toBe(U32(2048));
    expect(report.context.anchor).toEqual(anchor.asOpaque());
    expect(report.context.lookupAnchorSlot).toBe(Slot(42));
    expect(report.coreIndex).toBe(CoreId(5));
    expect(report.authorizerHash).toEqual(authorizerHash.asOpaque());
    expect(report.authorizationOutput).toEqual(authOutput);
    expect(report.results.length).toBe(2);
    expect(report.results[0]?.serviceId).toBe(ServiceId(1));
    expect(report.results[0]?.gas).toBe(Gas(100n));
    expect(report.results[1]?.serviceId).toBe(ServiceId(2));
    expect(report.results[1]?.gas).toBe(Gas(200n));
    expect(report.authorizationGasUsed).toBe(Gas(50n));
  });

  test("creates work results from result specifications", () => {
    const codeHash = blake2b.hashBytes(bytes.BytesBlob.blobFromNumbers([1, 2, 3]));
    const payload = bytes.BytesBlob.blobFromNumbers([4, 5, 6]);

    const report = createWorkReport(blake2b, {
      results: [
        {
          serviceId: ServiceId(10),
          codeHash,
          payload,
          gas: Gas(500n),
          result: { type: "ok" },
        },
        {
          serviceId: ServiceId(20),
          result: { type: "panic" },
        },
      ],
    });

    expect(report.results.length).toBe(2);
    expect(report.results[0]?.serviceId).toBe(ServiceId(10));
    expect(report.results[0]?.codeHash).toEqual(codeHash.asOpaque());
    expect(report.results[0]?.gas).toBe(Gas(500n));
    expect(report.results[0]?.result.kind).toBe(0); // ok
    expect(report.results[1]?.serviceId).toBe(ServiceId(20));
    expect(report.results[1]?.result.kind).toBe(2); // panic
  });

  test("integrates all components correctly", () => {
    const wpHash = blake2b.hashBytes(bytes.BytesBlob.blobFromNumbers([1]));
    const anchor = blake2b.hashBytes(bytes.BytesBlob.blobFromNumbers([2]));
    const authHash = blake2b.hashBytes(bytes.BytesBlob.blobFromNumbers([3]));
    const codeHash = blake2b.hashBytes(bytes.BytesBlob.blobFromNumbers([4]));

    const report = createWorkReport(blake2b, {
      workPackageSpec: {
        hash: wpHash.asOpaque(),
        length: U32(4096),
        exportsCount: U16(10),
      },
      context: {
        anchor: anchor.asOpaque(),
        lookupAnchorSlot: Slot(100),
        prerequisites: [wpHash.asOpaque()],
      },
      coreIndex: CoreId(3),
      authorizerHash: authHash,
      authorizationOutput: bytes.BytesBlob.blobFromNumbers([1, 2, 3, 4]),
      results: [
        {
          serviceId: ServiceId(1),
          codeHash,
          gas: Gas(1000n),
          load: {
            exportedSegments: U32(2),
            extrinsicCount: U32(5),
            extrinsicSize: U32(100),
            gasUsed: Gas(800n),
            importedSegments: U32(1),
          },
        },
      ],
      authorizationGasUsed: Gas(200n),
    });

    // Verify work package spec
    expect(report.workPackageSpec.hash).toEqual(wpHash.asOpaque());
    expect(report.workPackageSpec.length).toBe(U32(4096));
    expect(report.workPackageSpec.exportsCount).toBe(U16(10));

    // Verify context
    expect(report.context.anchor).toEqual(anchor.asOpaque());
    expect(report.context.lookupAnchorSlot).toBe(Slot(100));
    expect(report.context.prerequisites.length).toBe(1);

    // Verify core details
    expect(report.coreIndex).toBe(CoreId(3));
    expect(report.authorizerHash).toEqual(authHash.asOpaque());
    expect(report.authorizationGasUsed).toBe(Gas(200n));

    // Verify results
    expect(report.results.length).toBe(1);
    expect(report.results[0]?.serviceId).toBe(ServiceId(1));
    expect(report.results[0]?.codeHash).toEqual(codeHash.asOpaque());
    expect(report.results[0]?.gas).toBe(Gas(1000n));
    expect(report.results[0]?.load.exportedSegments).toBe(U32(2));
    expect(report.results[0]?.load.extrinsicCount).toBe(U32(5));
    expect(report.results[0]?.load.gasUsed).toBe(Gas(800n));
  });

  test("creates work report with empty results array", () => {
    const report = createWorkReport(blake2b, {
      results: [],
    });
    expect(report).toBeDefined();
    expect(report.results.length).toBe(0);
  });
});

describe("createWorkReportAsync", () => {
  test("creates work report without requiring hasher", async () => {
    const report = await createWorkReportAsync({
      results: [{ serviceId: ServiceId(1) }],
    });

    expect(report.results.length).toBe(1);
    expect(report.results[0]?.serviceId).toBe(ServiceId(1));
  });
});
