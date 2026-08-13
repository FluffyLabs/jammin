import { describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { WorkExecResultKind } from "@typeberry/lib/block";
import { BytesBlob } from "@typeberry/lib/bytes";
import { JamTest, JamTestAssertionError, service } from "./jam-test.js";
import { counterServiceBytes } from "./test-fixtures/counter-service.js";

const COUNTER_ID = 42;
const SUCCESS_GAS = 5_000_000n;

async function counterJam() {
  return await JamTest.fromServices({
    counter: service(counterServiceBytes(), {
      id: COUNTER_ID,
      info: {
        accumulateMinGas: 0n,
        onTransferMinGas: 0n,
      },
    }),
  });
}

describe("JamTest service registry", () => {
  test("allocates IDs, exposes names and resolves services", async () => {
    const jam = await JamTest.fromServices({
      automatic: service(counterServiceBytes()),
      explicit: service(counterServiceBytes(), { id: 7 }),
    });

    expect(jam.services.automatic.id).toBe(0);
    expect(jam.services.explicit.id).toBe(7);
    expect(jam.service("automatic").name).toBe("automatic");
    expect(jam.service(7).name).toBe("explicit");
    expect(jam.service("explicit").info().codeHash.raw).toEqual(jam.services.explicit.codeHash.raw);
  });

  test("rejects duplicate IDs and unknown services", async () => {
    await expect(
      JamTest.fromServices({
        first: service(counterServiceBytes(), { id: 5 }),
        second: service(counterServiceBytes(), { id: 5 }),
      }),
    ).rejects.toThrow("Duplicate service ID 5");

    const jam = await counterJam();
    expect(() => jam.service("missing")).toThrow("Unknown JAM service 'missing'");
  });

  test("loads a service binary from a .jam path", async () => {
    const directory = `${process.env.TMPDIR ?? "/tmp"}/jammin-jam-test-${crypto.randomUUID()}`;
    const path = `${directory}/counter.jam`;
    await Bun.write(path, counterServiceBytes());
    try {
      const jam = await JamTest.fromServices({ counter: service(path, { id: COUNTER_ID }) });
      expect(jam.services.counter.code.raw).toEqual(counterServiceBytes());
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe("JamTest work reports", () => {
  test("fills service ID, code hash, gas and a stable package hash", async () => {
    const jam = await counterJam();
    const first = jam.report({ id: "increment", service: "counter" });
    const same = jam.report({ id: "increment", service: "counter" });
    const different = jam.report({ id: "increment-again", service: "counter" });
    const result = first.results[0];

    expect(result?.serviceId).toBe(COUNTER_ID);
    expect(result?.codeHash.raw).toEqual(jam.services.counter.codeHash.raw);
    expect(result?.gas).toBe(10_000_000n);
    expect(first.workPackageSpec.hash.raw).toEqual(same.workPackageSpec.hash.raw);
    expect(first.workPackageSpec.hash.raw).not.toEqual(different.workPackageSpec.hash.raw);
  });

  test("supports multiple named results and convenient output encoding", async () => {
    const jam = await JamTest.fromServices({
      first: service(counterServiceBytes(), { id: 1 }),
      second: service(counterServiceBytes(), { id: 2 }),
    });
    const report = jam.report({
      id: "multi",
      results: [
        { service: "first", gas: 100n, output: "hello" },
        { service: "second", gas: 200n, result: { type: "panic" } },
      ],
    });

    expect(report.results[0]?.result.okBlob?.asText()).toBe("hello");
    expect(report.results[1]?.result.kind).toBe(WorkExecResultKind.panic);
  });

  test("rejects ambiguous and empty report declarations", async () => {
    const jam = await counterJam();

    expect(() => jam.report({ service: "counter", results: [{ service: "counter" }] })).toThrow(
      "either 'service' or 'results'",
    );
    expect(() => jam.report({ results: [] })).toThrow("at least one result");
    expect(() => jam.report({})).toThrow("requires 'service' or 'results'");
    expect(() => jam.report({ id: "", service: "counter" })).toThrow("ID must not be empty");
    expect(() =>
      jam.report({
        results: Array.from({ length: 17 }, () => ({ service: "counter" as const })),
      }),
    ).toThrow();
  });
});

describe("JamTest Lab 02 acceptance scenario", () => {
  test("persists normal writes and preserves the correct checkpoint after OOG", async () => {
    const jam = await counterJam();

    const round = async (slot: number, expected: bigint, outOfGas = false) => {
      const accumulation = await jam.accumulate({
        slot,
        reports: [{ id: `lab-02-round-${slot}`, service: "counter", gas: SUCCESS_GAS }],
      });

      accumulation.expect.serviceExecuted("counter");
      if (outOfGas) {
        accumulation.expect.serviceOutOfGas("counter");
      } else {
        accumulation.expect.serviceCompleted("counter");
      }
      jam.expect.storage.u64("counter", "cntr", expected);
      expect(accumulation.trace.executedServices).toEqual([
        {
          id: COUNTER_ID,
          name: "counter",
          workResults: 1,
          gasUsed: accumulation.statistics("counter")?.gasUsed,
        },
      ]);
      expect(jam.service("counter").info().lastAccumulation).toBe(slot);
    };

    jam.expect.storage.missing("counter", "cntr");
    await round(1, 1n);
    await round(2, 2n);
    await round(3, 2n, true);
    await round(4, 3n, true);
    await round(5, 4n);
  });

  test("provides typed state readers and useful assertion failures", async () => {
    const jam = await counterJam();
    await jam.accumulate({ slot: 1, reports: [{ service: "counter" }] });

    expect(jam.service("counter").storage.bytes("cntr")?.raw).toEqual(
      BytesBlob.blobFromNumbers([1, 0, 0, 0, 0, 0, 0, 0]).raw,
    );
    expect(() => jam.service("counter").storage.u32("cntr")).toThrow("expected 4 bytes, got 8");
    expect(() => jam.expect.storage.u64("counter", "cntr", 99n)).toThrow(JamTestAssertionError);
  });
});

describe("JamTest scenario branches", () => {
  test("snapshots, restores, forks and resets without sharing mutable state", async () => {
    const jam = await counterJam();
    await jam.accumulate({ slot: 1, reports: [{ service: "counter" }] });
    const afterFirstIncrement = jam.snapshot("after-first-increment");

    await jam.accumulate({ slot: 2, reports: [{ service: "counter" }] });
    jam.expect.storage.u64("counter", "cntr", 2n);
    expect(jam.history.map((entry) => entry.slot)).toEqual([1, 2]);

    jam.restore(afterFirstIncrement);
    jam.expect.storage.u64("counter", "cntr", 1n);
    expect(jam.history.map((entry) => entry.slot)).toEqual([1]);

    const fork = await jam.fork();
    await fork.accumulate({ slot: 2, reports: [{ service: "counter" }] });
    fork.expect.storage.u64("counter", "cntr", 2n);
    jam.expect.storage.u64("counter", "cntr", 1n);

    jam.reset();
    jam.expect.storage.missing("counter", "cntr");
    expect(jam.history).toEqual([]);
  });
});
