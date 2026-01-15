import { beforeAll, describe, expect, test } from "bun:test";
import * as block from "@typeberry/lib/block";
import * as bytes from "@typeberry/lib/bytes";
import * as h from "@typeberry/lib/hash";
import {
  createRefineContext,
  createWorkPackageSpec,
  createWorkReport,
  createWorkReportAsync,
  createWorkResult,
  WorkReportBuilder,
} from "./work-report.js";

describe("createWorkResult", () => {
  let blake2b: h.Blake2b;

  beforeAll(async () => {
    blake2b = await h.Blake2b.createHasher();
  });

  test("creates a work result with minimal options", () => {
    const result = createWorkResult(blake2b, {
      serviceId: 1,
    });

    expect(result.serviceId).toBe(block.tryAsServiceId(1));
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
      result: { type: "ok", output },
      load: {
        exportedSegments: 5,
        extrinsicCount: 10,
        extrinsicSize: 200,
        gasUsed: 500n,
        importedSegments: 3,
      },
    });

    // @ts-expect-error - comparing branded type to plain number
    expect(result.serviceId).toBe(42);
    expect(result.codeHash).toEqual(codeHash.asOpaque());
    // @ts-expect-error - comparing branded type to plain bigint
    expect(result.gas).toBe(1000n);
    expect(result.result.kind).toBe(0); // ok
    expect(result.result.okBlob).toEqual(output);
    // @ts-expect-error - comparing branded type to plain number
    expect(result.load.exportedSegments).toBe(5);
    // @ts-expect-error - comparing branded type to plain number
    expect(result.load.extrinsicCount).toBe(10);
    // @ts-expect-error - comparing branded type to plain number
    expect(result.load.extrinsicSize).toBe(200);
    // @ts-expect-error - comparing branded type to plain bigint
    expect(result.load.gasUsed).toBe(500n);
    // @ts-expect-error - comparing branded type to plain number
    expect(result.load.importedSegments).toBe(3);
  });

  test("creates an error result when result type is panic", () => {
    const result = createWorkResult(blake2b, {
      serviceId: 1,
      result: { type: "panic" },
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

    // @ts-expect-error - comparing branded type to plain number
    expect(result.load.exportedSegments).toBe(10);
    // @ts-expect-error - comparing branded type to plain number
    expect(result.load.extrinsicCount).toBe(0);
    // @ts-expect-error - comparing branded type to plain number
    expect(result.load.extrinsicSize).toBe(0);
    // @ts-expect-error - comparing branded type to plain bigint
    expect(result.load.gasUsed).toBe(0n);
    // @ts-expect-error - comparing branded type to plain number
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
    // @ts-expect-error - comparing branded type to plain number
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
    // @ts-expect-error - comparing branded type to plain number
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
    // @ts-expect-error - comparing branded type to plain number
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
    // @ts-expect-error - comparing branded type to plain number
    expect(spec.length).toBe(0);
    expect(spec.erasureRoot).toEqual(h.ZERO_HASH.asOpaque());
    expect(spec.exportsRoot).toEqual(h.ZERO_HASH.asOpaque());
    // @ts-expect-error - comparing branded type to plain number
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
    // @ts-expect-error - comparing branded type to plain number
    expect(spec.length).toBe(1024);
    expect(spec.erasureRoot).toEqual(erasureRoot.asOpaque());
    expect(spec.exportsRoot).toEqual(exportsRoot.asOpaque());
    // @ts-expect-error - comparing branded type to plain number
    expect(spec.exportsCount).toBe(5);
  });

  test("handles partial options", () => {
    const hash = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([1])));

    const spec = createWorkPackageSpec({
      hash,
      length: 512,
    });

    expect(spec.hash).toEqual(hash.asOpaque());
    // @ts-expect-error - comparing branded type to plain number
    expect(spec.length).toBe(512);
    expect(spec.erasureRoot).toEqual(h.ZERO_HASH.asOpaque());
    expect(spec.exportsRoot).toEqual(h.ZERO_HASH.asOpaque());
    // @ts-expect-error - comparing branded type to plain number
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
    // @ts-expect-error - comparing branded type to plain number
    expect(report.coreIndex).toBe(0);
    expect(report.authorizerHash).toEqual(h.ZERO_HASH.asOpaque());
    expect(report.authorizationOutput).toEqual(bytes.BytesBlob.blobFrom(new Uint8Array(0)));
    expect(report.segmentRootLookup).toEqual([]);
    expect(report.results.length).toBe(1);
    // @ts-expect-error - comparing branded type to plain bigint
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
    // @ts-expect-error - comparing branded type to plain number
    expect(report.workPackageSpec.length).toBe(2048);
    expect(report.context.anchor).toEqual(anchor.asOpaque());
    // @ts-expect-error - comparing branded type to plain number
    expect(report.context.lookupAnchorSlot).toBe(42);
    // @ts-expect-error - comparing branded type to plain number
    expect(report.coreIndex).toBe(5);
    expect(report.authorizerHash).toEqual(authorizerHash.asOpaque());
    expect(report.authorizationOutput).toEqual(authOutput);
    expect(report.results.length).toBe(2);
    // @ts-expect-error - comparing branded type to plain number
    expect(report.results[0].serviceId).toBe(1);
    // @ts-expect-error - comparing branded type to plain bigint
    expect(report.results[0].gas).toBe(100n);
    // @ts-expect-error - comparing branded type to plain number
    expect(report.results[1].serviceId).toBe(2);
    // @ts-expect-error - comparing branded type to plain bigint
    expect(report.results[1].gas).toBe(200n);
    // @ts-expect-error - comparing branded type to plain bigint
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
          result: { type: "ok" },
        },
        {
          serviceId: 20,
          result: { type: "panic" },
        },
      ],
    });

    expect(report.results.length).toBe(2);
    // @ts-expect-error - comparing branded type to plain number
    expect(report.results[0].serviceId).toBe(10);
    // @ts-expect-error - comparing branded type to OpaqueHash
    expect(report.results[0].codeHash).toEqual(codeHash.asOpaque());
    // @ts-expect-error - comparing branded type to plain bigint
    expect(report.results[0].gas).toBe(500n);
    // @ts-expect-error - comparing enum to plain number
    expect(report.results[0].result.kind).toBe(0); // ok
    // @ts-expect-error - comparing branded type to plain number
    expect(report.results[1].serviceId).toBe(20);
    // @ts-expect-error - comparing enum to plain number
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
    // @ts-expect-error - comparing branded type to plain number
    expect(report.workPackageSpec.length).toBe(4096);
    // @ts-expect-error - comparing branded type to plain number
    expect(report.workPackageSpec.exportsCount).toBe(10);

    // Verify context
    expect(report.context.anchor).toEqual(anchor.asOpaque());
    // @ts-expect-error - comparing branded type to plain number
    expect(report.context.lookupAnchorSlot).toBe(100);
    expect(report.context.prerequisites.length).toBe(1);

    // Verify core details
    // @ts-expect-error - comparing branded type to plain number
    expect(report.coreIndex).toBe(3);
    expect(report.authorizerHash).toEqual(authHash.asOpaque());
    // @ts-expect-error - comparing branded type to plain bigint
    expect(report.authorizationGasUsed).toBe(200n);

    // Verify results
    expect(report.results.length).toBe(1);
    // @ts-expect-error - comparing branded type to plain number
    expect(report.results[0].serviceId).toBe(1);
    // @ts-expect-error - comparing branded type to OpaqueHash
    expect(report.results[0].codeHash).toEqual(codeHash.asOpaque());
    // @ts-expect-error - comparing branded type to plain bigint
    expect(report.results[0].gas).toBe(1000n);
    // @ts-expect-error - comparing branded type to plain number
    expect(report.results[0].load.exportedSegments).toBe(2);
    // @ts-expect-error - comparing branded type to plain number
    expect(report.results[0].load.extrinsicCount).toBe(5);
    // @ts-expect-error - comparing branded type to plain bigint
    expect(report.results[0].load.gasUsed).toBe(800n);
  });

  test("throws error when results array is empty", () => {
    expect(() => {
      createWorkReport(blake2b, {
        results: [],
      });
    }).toThrow("WorkReport cannot contain less than 1 results");
  });

  test("throws error when results array exceeds 255 items", () => {
    const results = Array.from({ length: 256 }, (_, i) => ({ serviceId: i }));
    expect(() => {
      createWorkReport(blake2b, {
        results,
      });
    }).toThrow("WorkReport cannot contain more than 16 results");
  });
});

describe("createWorkReportAsync", () => {
  test("creates work report without requiring hasher", async () => {
    const report = await createWorkReportAsync({
      results: [{ serviceId: 1 }],
    });

    expect(report.results.length).toBe(1);
    // @ts-expect-error - comparing branded type to plain number
    expect(report.results[0].serviceId).toBe(1);
  });
});

describe("WorkReportBuilder", () => {
  let blake2b: h.Blake2b;

  beforeAll(async () => {
    blake2b = await h.Blake2b.createHasher();
  });

  test("builds work report using fluent API", async () => {
    const report = await new WorkReportBuilder()
      .withCoreIndex(5)
      .addResult({ serviceId: 1, gas: 1000n })
      .addResult({ serviceId: 2, gas: 2000n })
      .build();

    // @ts-expect-error - comparing branded type to plain number
    expect(report.coreIndex).toBe(5);
    expect(report.results.length).toBe(2);
    // @ts-expect-error - comparing branded type to plain bigint
    expect(report.results[0].gas).toBe(1000n);
    // @ts-expect-error - comparing branded type to plain bigint
    expect(report.results[1].gas).toBe(2000n);
  });

  test("withWorkPackageSpec sets work package specification", async () => {
    const hash = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([1, 2, 3])));

    const report = await new WorkReportBuilder()
      .withWorkPackageSpec({ hash, length: 2048, exportsCount: 10 })
      .addResult({ serviceId: 1 })
      .build();

    expect(report.workPackageSpec.hash).toEqual(hash.asOpaque());
    // @ts-expect-error - comparing branded type to plain number
    expect(report.workPackageSpec.length).toBe(2048);
    // @ts-expect-error - comparing branded type to plain number
    expect(report.workPackageSpec.exportsCount).toBe(10);
  });

  test("withContext sets blockchain state context", async () => {
    const anchor = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([1])));
    const stateRoot = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([2])));

    const report = await new WorkReportBuilder()
      .withContext({
        anchor,
        stateRoot,
        lookupAnchorSlot: 42,
      })
      .addResult({ serviceId: 1 })
      .build();

    expect(report.context.anchor).toEqual(anchor.asOpaque());
    expect(report.context.stateRoot).toEqual(stateRoot.asOpaque());
    // @ts-expect-error - comparing branded type to plain number
    expect(report.context.lookupAnchorSlot).toBe(42);
  });

  test("withCoreIndex sets core index", async () => {
    const report = await new WorkReportBuilder().withCoreIndex(7).addResult({ serviceId: 1 }).build();

    // @ts-expect-error - comparing branded type to plain number
    expect(report.coreIndex).toBe(7);
  });

  test("withAuthorizerHash sets authorizer hash", async () => {
    const authHash = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([1, 2, 3])));

    const report = await new WorkReportBuilder().withAuthorizerHash(authHash).addResult({ serviceId: 1 }).build();

    expect(report.authorizerHash).toEqual(authHash.asOpaque());
  });

  test("withAuthorizationOutput sets authorization output", async () => {
    const output = bytes.BytesBlob.blobFrom(new Uint8Array([10, 20, 30]));

    const report = await new WorkReportBuilder().withAuthorizationOutput(output).addResult({ serviceId: 1 }).build();

    expect(report.authorizationOutput).toEqual(output);
  });

  test("withAuthorizationGas sets authorization gas used", async () => {
    const report = await new WorkReportBuilder().withAuthorizationGas(500n).addResult({ serviceId: 1 }).build();

    // @ts-expect-error - comparing branded type to plain bigint
    expect(report.authorizationGasUsed).toBe(500n);
  });

  test("withSegmentRootLookup sets segment root lookup table", async () => {
    const lookup: ReturnType<typeof block.refineContext.WorkPackageInfo.create>[] = [];

    const report = await new WorkReportBuilder().withSegmentRootLookup(lookup).addResult({ serviceId: 1 }).build();

    expect(report.segmentRootLookup).toEqual(lookup);
  });

  test("addResult adds work results", async () => {
    const codeHash = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([1, 2, 3])));
    const payload = bytes.BytesBlob.blobFrom(new Uint8Array([4, 5, 6]));

    const report = await new WorkReportBuilder()
      .addResult({ serviceId: 1, gas: 100n })
      .addResult({ serviceId: 2, codeHash, payload, gas: 200n })
      .addResult({ serviceId: 3, gas: 300n, result: { type: "panic" } })
      .build();

    expect(report.results.length).toBe(3);
    // @ts-expect-error - comparing branded type to plain number
    expect(report.results[0].serviceId).toBe(1);
    // @ts-expect-error - comparing branded type to plain bigint
    expect(report.results[0].gas).toBe(100n);
    // @ts-expect-error - comparing branded type to plain number
    expect(report.results[1].serviceId).toBe(2);
    // @ts-expect-error - comparing branded type to OpaqueHash
    expect(report.results[1].codeHash).toEqual(codeHash.asOpaque());
    // @ts-expect-error - comparing branded type to plain bigint
    expect(report.results[1].gas).toBe(200n);
    // @ts-expect-error - comparing branded type to plain number
    expect(report.results[2].serviceId).toBe(3);
    // @ts-expect-error - comparing enum to plain number
    expect(report.results[2].result.kind).toBe(2); // panic
  });

  test("builder supports method chaining", async () => {
    const hash = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([1])));
    const anchor = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([2])));

    const report = await new WorkReportBuilder()
      .withWorkPackageSpec({ hash, length: 1024 })
      .withContext({ anchor })
      .withCoreIndex(3)
      .withAuthorizationGas(100n)
      .addResult({ serviceId: 1, gas: 500n })
      .addResult({ serviceId: 2, gas: 600n })
      .build();

    // @ts-expect-error - comparing branded type to plain number
    expect(report.coreIndex).toBe(3);
    expect(report.results.length).toBe(2);
    expect(report.workPackageSpec.hash).toEqual(hash.asOpaque());
    expect(report.context.anchor).toEqual(anchor.asOpaque());
    // @ts-expect-error - comparing branded type to plain bigint
    expect(report.authorizationGasUsed).toBe(100n);
  });

  test("buildSync throws without hasher", () => {
    expect(() => {
      new WorkReportBuilder().addResult({ serviceId: 1 }).buildSync();
    }).toThrow("Blake2b hasher must be set");
  });

  test("buildSync works with hasher", () => {
    const report = new WorkReportBuilder().withHasher(blake2b).addResult({ serviceId: 1 }).buildSync();

    expect(report.results.length).toBe(1);
  });

  test("build creates hasher automatically if not provided", async () => {
    const report = await new WorkReportBuilder().addResult({ serviceId: 1, gas: 1000n }).build();

    expect(report.results.length).toBe(1);
    // @ts-expect-error - comparing branded type to plain bigint
    expect(report.results[0].gas).toBe(1000n);
  });

  test("builds complex work report with all options", async () => {
    const wpHash = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([1])));
    const anchor = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([2])));
    const authHash = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([3])));
    const codeHash = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([4])));
    const payload = bytes.BytesBlob.blobFrom(new Uint8Array([5, 6, 7]));
    const authOutput = bytes.BytesBlob.blobFrom(new Uint8Array([8, 9, 10]));

    const report = new WorkReportBuilder()
      .withHasher(blake2b)
      .withWorkPackageSpec({
        hash: wpHash,
        length: 4096,
        exportsCount: 15,
      })
      .withContext({
        anchor,
        lookupAnchorSlot: 200,
      })
      .withCoreIndex(8)
      .withAuthorizerHash(authHash)
      .withAuthorizationOutput(authOutput)
      .withAuthorizationGas(250n)
      .addResult({
        serviceId: 10,
        codeHash,
        payload,
        gas: 5000n,
        load: {
          exportedSegments: 3,
          extrinsicCount: 7,
          extrinsicSize: 150,
          gasUsed: 4500n,
          importedSegments: 2,
        },
      })
      .buildSync();

    // Verify work package spec
    expect(report.workPackageSpec.hash).toEqual(wpHash.asOpaque());
    // @ts-expect-error - comparing branded type to plain number
    expect(report.workPackageSpec.length).toBe(4096);
    // @ts-expect-error - comparing branded type to plain number
    expect(report.workPackageSpec.exportsCount).toBe(15);

    // Verify context
    expect(report.context.anchor).toEqual(anchor.asOpaque());
    // @ts-expect-error - comparing branded type to plain number
    expect(report.context.lookupAnchorSlot).toBe(200);

    // Verify core details
    // @ts-expect-error - comparing branded type to plain number
    expect(report.coreIndex).toBe(8);
    expect(report.authorizerHash).toEqual(authHash.asOpaque());
    expect(report.authorizationOutput).toEqual(authOutput);
    // @ts-expect-error - comparing branded type to plain bigint
    expect(report.authorizationGasUsed).toBe(250n);

    // Verify results
    expect(report.results.length).toBe(1);
    // @ts-expect-error - comparing branded type to plain number
    expect(report.results[0].serviceId).toBe(10);
    // @ts-expect-error - comparing branded type to OpaqueHash
    expect(report.results[0].codeHash).toEqual(codeHash.asOpaque());
    // @ts-expect-error - comparing branded type to plain bigint
    expect(report.results[0].gas).toBe(5000n);
    // @ts-expect-error - comparing branded type to plain number
    expect(report.results[0].load.exportedSegments).toBe(3);
    // @ts-expect-error - comparing branded type to plain number
    expect(report.results[0].load.extrinsicCount).toBe(7);
    // @ts-expect-error - comparing branded type to plain number
    expect(report.results[0].load.extrinsicSize).toBe(150);
    // @ts-expect-error - comparing branded type to plain bigint
    expect(report.results[0].load.gasUsed).toBe(4500n);
    // @ts-expect-error - comparing branded type to plain number
    expect(report.results[0].load.importedSegments).toBe(2);
  });
});

describe("validation", () => {
  let blake2b: h.Blake2b;

  beforeAll(async () => {
    blake2b = await h.Blake2b.createHasher();
  });

  test("throws error for invalid U32 value", () => {
    expect(() => {
      createWorkResult(blake2b, {
        serviceId: 1,
        load: { exportedSegments: -1 },
      });
    }).toThrow("exportedSegments must be a valid U32");

    expect(() => {
      createWorkResult(blake2b, {
        serviceId: 1,
        load: { exportedSegments: 0x100000000 }, // 2^32
      });
    }).toThrow("exportedSegments must be a valid U32");
  });

  test("throws error for negative gas", () => {
    expect(() => {
      createWorkResult(blake2b, {
        serviceId: 1,
        gas: -100n,
      });
    }).toThrow("gas must be non-negative");
  });

  test("throws error for invalid U16 value", () => {
    expect(() => {
      createWorkPackageSpec({
        exportsCount: 0x10000, // 2^16
      });
    }).toThrow("exportsCount must be a valid U16");
  });
});
