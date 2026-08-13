import { describe, expect, test } from "bun:test";
import { Buffer } from "node:buffer";
import { SEGMENT_BYTES, WorkReport } from "@typeberry/lib/block";
import { Encoder } from "@typeberry/lib/codec";
import { tinyChainSpec } from "@typeberry/lib/config";
import { JamTest, service } from "./jam-test.js";
import { TypeberryRpcRefineBackend } from "./refine.js";
import { counterServiceBytes } from "./test-fixtures/counter-service.js";

async function refineJam() {
  return await JamTest.fromServices({
    authorizer: service(counterServiceBytes(), { id: 10 }),
    first: service(counterServiceBytes(), { id: 11 }),
    second: service(counterServiceBytes(), { id: 12 }),
  });
}

describe("JamTest Refine", () => {
  test("builds ordered multi-item packages with imports, extrinsics and exports", async () => {
    const jam = await refineJam();
    const importedRoot = jam.hash("prior-exports-root");
    const workPackage = jam.workPackage({
      authorizationService: "authorizer",
      authorization: "allow",
      parametrization: "config",
      items: [
        {
          service: "first",
          payload: "one",
          extrinsics: ["first-a", "first-b"],
          exportCount: 1,
        },
        {
          service: "second",
          payload: "two",
          imports: [{ treeRoot: importedRoot, index: 7 }],
          extrinsics: ["second-a"],
          exportCount: 2,
        },
      ],
    });

    expect(workPackage.value.authCodeHost).toBe(10);
    expect(workPackage.value.items.map((item) => item.service)).toEqual([11, 12]);
    expect(workPackage.value.items.map((item) => item.exportCount)).toEqual([1, 2]);
    expect(workPackage.value.items[1]?.importSegments[0]?.index).toBe(7);
    expect(workPackage.extrinsics.map((blob) => blob.asText())).toEqual(["first-a", "first-b", "second-a"]);

    const report = jam.report({
      id: "refined",
      results: [{ service: "first" }, { service: "second" }],
    });
    const encodedReport = Encoder.encodeObject(WorkReport.Codec, report, tinyChainSpec);
    const exportBytes = [1, 2, 3].flatMap((value) => new Array(SEGMENT_BYTES).fill(value));
    let rpcBody: Record<string, unknown> | undefined;
    const backend = new TypeberryRpcRefineBackend("http://typeberry.test", async (_input, init) => {
      rpcBody = JSON.parse(String(init?.body));
      return Response.json({
        jsonrpc: "2.0",
        id: 1,
        result: {
          report: Buffer.from(encodedReport.raw).toString("base64"),
          exports: Buffer.from(exportBytes).toString("base64"),
        },
      });
    });

    const refined = await jam.refine(workPackage, { backend, coreIndex: 1 });
    expect(rpcBody?.method).toBe("typeberry_refineWorkPackage");
    expect((rpcBody?.params as unknown[])[0]).toBe(1);
    expect(typeof (rpcBody?.params as unknown[])[1]).toBe("string");
    expect(refined.report).toEqual(report);
    expect(refined.exports.map((segments) => segments.length)).toEqual([1, 2]);
    expect(refined.exports[0]?.[0]?.raw[0]).toBe(1);
    expect(refined.exports[1]?.[0]?.raw[0]).toBe(2);
    expect(refined.exports[1]?.[1]?.raw[0]).toBe(3);
  });

  test("rejects a node response whose export bytes do not match the package manifest", async () => {
    const jam = await refineJam();
    const workPackage = jam.workPackage({ items: [{ service: "first", exportCount: 1 }] });
    const report = jam.report({ service: "first" });
    const encodedReport = Encoder.encodeObject(WorkReport.Codec, report, tinyChainSpec);
    const backend = new TypeberryRpcRefineBackend("http://typeberry.test", async () =>
      Response.json({
        jsonrpc: "2.0",
        id: 1,
        result: { report: Buffer.from(encodedReport.raw).toString("base64"), exports: "" },
      }),
    );

    await expect(jam.refine(workPackage, { backend })).rejects.toThrow(`expected ${SEGMENT_BYTES}`);
  });
});
