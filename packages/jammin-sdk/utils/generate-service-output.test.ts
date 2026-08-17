import { afterEach, describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { Bytes } from "@typeberry/lib/bytes";
import { HASH_SIZE } from "@typeberry/lib/hash";
import { generateServiceOutput } from "./generate-service-output.js";

const temporaryPaths: string[] = [];

async function temporaryJamFile(): Promise<string> {
  const path = join(import.meta.dir, `service-${crypto.randomUUID()}.jam`);
  temporaryPaths.push(path);
  await Bun.write(path, Uint8Array.from([1, 2, 3]));
  return path;
}

afterEach(async () => {
  await Promise.all(temporaryPaths.splice(0).map((path) => rm(path, { force: true })));
});

describe("generateServiceOutput", () => {
  test("preserves explicit zero service info overrides", async () => {
    const output = await generateServiceOutput(await temporaryJamFile(), "zero-service", 7, undefined, {
      balance: 0n,
      accumulateMinGas: 0n,
      onTransferMinGas: 0n,
      storageUtilisationBytes: 0n,
      gratisStorage: 0n,
      storageUtilisationCount: 0,
      created: 0,
      lastAccumulation: 0,
      parentService: 0,
    });

    expect(output.info).toEqual({
      balance: 0n,
      accumulateMinGas: 0n,
      onTransferMinGas: 0n,
      storageUtilisationBytes: 0n,
      gratisStorage: 0n,
      storageUtilisationCount: 0,
      created: 0,
      lastAccumulation: 0,
      parentService: 0,
    });
  });

  test("decodes configured preimage blobs from hex", async () => {
    const hashString = `0x${"01".repeat(HASH_SIZE)}`;
    const hash = Bytes.parseBytes(hashString, HASH_SIZE).asOpaque();
    const output = await generateServiceOutput(await temporaryJamFile(), "preimage-service", 8, undefined, undefined, {
      [hashString]: "0xdeadbeef",
    });

    expect(output.preimageBlobs?.get(hash)?.raw).toEqual(Uint8Array.from([0xde, 0xad, 0xbe, 0xef]));
  });
});
