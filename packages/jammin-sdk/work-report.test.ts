import { beforeAll, describe, expect, test } from "bun:test";
import { block, bytes, hash as h } from "@typeberry/lib";
import { createRefineContext, createWorkPackageSpec, createWorkReport, createWorkResult } from "./work-report.js";

describe("createWorkResult", () => {
  let blake2b: h.Blake2b;

  beforeAll(async () => {
    blake2b = await h.Blake2b.createHasher();
  });

  test("creates a work result with minimal options", () => {
    const result = createWorkResult(blake2b, {
      serviceId: 1,
    });

    expect(result.serviceId).toEqual(block.tryAsServiceId(1));
    expect(result.codeHash).toEqual(h.ZERO_HASH.asOpaque());
    expect(result.gas).toBe(block.tryAsServiceGas(0n));
    expect(result.result.kind).toBe(0); // ok
    expect(result.result.okBlob).toEqual(bytes.BytesBlob.blobFrom(new Uint8Array()));
  });

  test("creates a work result with all options", () => {
    const codeHash = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([1, 2, 3])));
    const payload = bytes.BytesBlob.blobFrom(new Uint8Array([4, 5, 6]));
    const output = bytes.BytesBlob.blobFrom(new Uint8Array([7, 8, 9]));

    const result = createWorkResult(blake2b, {
      serviceId: 42,
      codeHash,
      payload,
      gas: 1000n,
      output,
      isError: false,
      load: {
        exportedSegments: 5,
        extrinsicCount: 10,
        extrinsicSize: 200,
        gasUsed: 500n,
        importedSegments: 3,
      },
    });

    expect(result.serviceId).toBe(42);
    expect(result.codeHash).toEqual(codeHash.asOpaque());
    expect(result.gas).toBe(1000n);
    expect(result.result.kind).toBe(0); // ok
    expect(result.result.okBlob).toEqual(output);
    expect(result.load.exportedSegments).toBe(5);
    expect(result.load.extrinsicCount).toBe(10);
    expect(result.load.extrinsicSize).toBe(200);
    expect(result.load.gasUsed).toBe(500n);
    expect(result.load.importedSegments).toBe(3);
  });

  test("creates an error result when isError is true", () => {
    const result = createWorkResult(blake2b, {
      serviceId: 1,
      isError: true,
    });

    expect(result.result.kind).toBe(2); // panic
    expect(result.result.okBlob).toBeNull();
  });

  test("computes correct payload hash", () => {
    const payload = bytes.BytesBlob.blobFrom(new Uint8Array([1, 2, 3, 4, 5]));
    const expectedHash = blake2b.hashBytes(payload);

    const result = createWorkResult(blake2b, {
      serviceId: 1,
      payload,
    });

    expect(result.payloadHash).toEqual(expectedHash);
  });

  test("handles partial load options with defaults", () => {
    const result = createWorkResult(blake2b, {
      serviceId: 1,
      load: {
        exportedSegments: 10,
        // Other fields should default to 0
      },
    });

    expect(result.load.exportedSegments).toBe(10);
    expect(result.load.extrinsicCount).toBe(0);
    expect(result.load.extrinsicSize).toBe(0);
    expect(result.load.gasUsed).toBe(0n);
    expect(result.load.importedSegments).toBe(0);
  });
});

describe("createRefineContext", () => {
  let blake2b: h.Blake2b;

  beforeAll(async () => {
    blake2b = await h.Blake2b.createHasher();
  });

  test("creates a refine context with minimal options", () => {
    const context = createRefineContext({});

    expect(context.anchor).toEqual(h.ZERO_HASH.asOpaque());
    expect(context.stateRoot).toEqual(h.ZERO_HASH.asOpaque());
    expect(context.beefyRoot).toEqual(h.ZERO_HASH.asOpaque());
    expect(context.lookupAnchor).toEqual(h.ZERO_HASH.asOpaque());
    expect(context.lookupAnchorSlot).toBe(0);
    expect(context.prerequisites).toEqual([]);
  });

  test("creates a refine context with all options", () => {
    const anchor = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([1])));
    const stateRoot = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([2])));
    const beefyRoot = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([3])));
    const lookupAnchor = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([4])));
    const prereq1 = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([5])));
    const prereq2 = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([6])));

    const context = createRefineContext({
      anchor,
      stateRoot,
      beefyRoot,
      lookupAnchor,
      lookupAnchorSlot: 100,
      prerequisites: [prereq1, prereq2],
    });

    expect(context.anchor).toEqual(anchor.asOpaque());
    expect(context.stateRoot).toEqual(stateRoot.asOpaque());
    expect(context.beefyRoot).toEqual(beefyRoot.asOpaque());
    expect(context.lookupAnchor).toEqual(lookupAnchor.asOpaque());
    expect(context.lookupAnchorSlot).toBe(100);
    expect(context.prerequisites).toEqual([prereq1.asOpaque(), prereq2.asOpaque()]);
  });

  test("handles partial options", () => {
    const anchor = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([1])));

    const context = createRefineContext({
      anchor,
      lookupAnchorSlot: 50,
    });

    expect(context.anchor).toEqual(anchor.asOpaque());
    expect(context.stateRoot).toEqual(h.ZERO_HASH.asOpaque());
    expect(context.beefyRoot).toEqual(h.ZERO_HASH.asOpaque());
    expect(context.lookupAnchor).toEqual(h.ZERO_HASH.asOpaque());
    expect(context.lookupAnchorSlot).toBe(50);
    expect(context.prerequisites).toEqual([]);
  });
});

describe("createWorkPackageSpec", () => {
  let blake2b: h.Blake2b;

  beforeAll(async () => {
    blake2b = await h.Blake2b.createHasher();
  });

  test("creates a work package spec with minimal options", () => {
    const spec = createWorkPackageSpec({});

    expect(spec.hash).toEqual(h.ZERO_HASH.asOpaque());
    expect(spec.length).toBe(0);
    expect(spec.erasureRoot).toEqual(h.ZERO_HASH.asOpaque());
    expect(spec.exportsRoot).toEqual(h.ZERO_HASH.asOpaque());
    expect(spec.exportsCount).toBe(0);
  });

  test("creates a work package spec with all options", () => {
    const hash = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([1])));
    const erasureRoot = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([2])));
    const exportsRoot = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([3])));

    const spec = createWorkPackageSpec({
      hash,
      length: 1024,
      erasureRoot,
      exportsRoot,
      exportsCount: 5,
    });

    expect(spec.hash).toEqual(hash.asOpaque());
    expect(spec.length).toBe(1024);
    expect(spec.erasureRoot).toEqual(erasureRoot.asOpaque());
    expect(spec.exportsRoot).toEqual(exportsRoot.asOpaque());
    expect(spec.exportsCount).toBe(5);
  });

  test("handles partial options", () => {
    const hash = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([1])));

    const spec = createWorkPackageSpec({
      hash,
      length: 512,
    });

    expect(spec.hash).toEqual(hash.asOpaque());
    expect(spec.length).toBe(512);
    expect(spec.erasureRoot).toEqual(h.ZERO_HASH.asOpaque());
    expect(spec.exportsRoot).toEqual(h.ZERO_HASH.asOpaque());
    expect(spec.exportsCount).toBe(0);
  });
});

describe("createWorkReport", () => {
  let blake2b: h.Blake2b;

  beforeAll(async () => {
    blake2b = await h.Blake2b.createHasher();
  });

  test("creates a work report with minimal options", () => {
    const report = createWorkReport(blake2b, {
      results: [{ serviceId: 1 }],
    });

    expect(report.workPackageSpec.hash).toEqual(h.ZERO_HASH.asOpaque());
    expect(report.context.anchor).toEqual(h.ZERO_HASH.asOpaque());
    expect(report.coreIndex).toBe(0);
    expect(report.authorizerHash).toEqual(h.ZERO_HASH.asOpaque());
    expect(report.authorizationOutput).toEqual(bytes.BytesBlob.blobFrom(new Uint8Array(0)));
    expect(report.segmentRootLookup).toEqual([]);
    expect(report.results.length).toBe(1);
    expect(report.authorizationGasUsed).toBe(0n);
  });

  test("creates a work report with all options", () => {
    const hash = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([1])));
    const anchor = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([2])));
    const authorizerHash = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([3])));
    const authOutput = bytes.BytesBlob.blobFrom(new Uint8Array([10, 11, 12]));

    const report = createWorkReport(blake2b, {
      workPackageSpec: {
        hash,
        length: 2048,
      },
      context: {
        anchor,
        lookupAnchorSlot: 42,
      },
      coreIndex: 5,
      authorizerHash,
      authorizationOutput: authOutput,
      segmentRootLookup: [],
      results: [
        { serviceId: 1, gas: 100n },
        { serviceId: 2, gas: 200n },
      ],
      authorizationGasUsed: 50n,
    });

    expect(report.workPackageSpec.hash).toEqual(hash.asOpaque());
    expect(report.workPackageSpec.length).toBe(2048);
    expect(report.context.anchor).toEqual(anchor.asOpaque());
    expect(report.context.lookupAnchorSlot).toBe(42);
    expect(report.coreIndex).toBe(5);
    expect(report.authorizerHash).toEqual(authorizerHash.asOpaque());
    expect(report.authorizationOutput).toEqual(authOutput);
    expect(report.results.length).toBe(2);
    expect(report.results[0].serviceId).toBe(1);
    expect(report.results[0].gas).toBe(100n);
    expect(report.results[1].serviceId).toBe(2);
    expect(report.results[1].gas).toBe(200n);
    expect(report.authorizationGasUsed).toBe(50n);
  });

  test("creates work results from result specifications", () => {
    const codeHash = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([1, 2, 3])));
    const payload = bytes.BytesBlob.blobFrom(new Uint8Array([4, 5, 6]));

    const report = createWorkReport(blake2b, {
      results: [
        {
          serviceId: 10,
          codeHash,
          payload,
          gas: 500n,
          isError: false,
        },
        {
          serviceId: 20,
          isError: true,
        },
      ],
    });

    expect(report.results.length).toBe(2);
    expect(report.results[0].serviceId).toBe(10);
    expect(report.results[0].codeHash).toEqual(codeHash.asOpaque());
    expect(report.results[0].gas).toBe(500n);
    expect(report.results[0].result.kind).toBe(0); // ok
    expect(report.results[1].serviceId).toBe(20);
    expect(report.results[1].result.kind).toBe(2); // panic
  });

  test("integrates all components correctly", () => {
    const wpHash = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([1])));
    const anchor = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([2])));
    const authHash = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([3])));
    const codeHash = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([4])));

    const report = createWorkReport(blake2b, {
      workPackageSpec: {
        hash: wpHash,
        length: 4096,
        exportsCount: 10,
      },
      context: {
        anchor,
        lookupAnchorSlot: 100,
        prerequisites: [wpHash],
      },
      coreIndex: 3,
      authorizerHash: authHash,
      authorizationOutput: bytes.BytesBlob.blobFrom(new Uint8Array([1, 2, 3, 4])),
      results: [
        {
          serviceId: 1,
          codeHash,
          gas: 1000n,
          load: {
            exportedSegments: 2,
            extrinsicCount: 5,
            extrinsicSize: 100,
            gasUsed: 800n,
            importedSegments: 1,
          },
        },
      ],
      authorizationGasUsed: 200n,
    });

    // Verify work package spec
    expect(report.workPackageSpec.hash).toEqual(wpHash.asOpaque());
    expect(report.workPackageSpec.length).toBe(4096);
    expect(report.workPackageSpec.exportsCount).toBe(10);

    // Verify context
    expect(report.context.anchor).toEqual(anchor.asOpaque());
    expect(report.context.lookupAnchorSlot).toBe(100);
    expect(report.context.prerequisites.length).toBe(1);

    // Verify core details
    expect(report.coreIndex).toBe(3);
    expect(report.authorizerHash).toEqual(authHash.asOpaque());
    expect(report.authorizationGasUsed).toBe(200n);

    // Verify results
    expect(report.results.length).toBe(1);
    expect(report.results[0].serviceId).toBe(1);
    expect(report.results[0].codeHash).toEqual(codeHash.asOpaque());
    expect(report.results[0].gas).toBe(1000n);
    expect(report.results[0].load.exportedSegments).toBe(2);
    expect(report.results[0].load.extrinsicCount).toBe(5);
    expect(report.results[0].load.gasUsed).toBe(800n);
  });
});
