import { describe, expect, test } from "bun:test";
import { JamTest, service } from "./jam-test.js";
import { counterServiceBytes } from "./test-fixtures/counter-service.js";

const COUNTER_ID = 42;

async function pipelineJam() {
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

describe("JamPipeline", () => {
  test("runs a signed guarantee through strict-supermajority availability into accumulation", async () => {
    const jam = await pipelineJam();
    const pipeline = await jam.pipeline();
    const report = pipeline.report({ id: "pipeline-counter", service: "counter", gas: 5_000_000n });

    const pending = await pipeline.guarantee(report);
    expect(pending.guarantors).toHaveLength(2);
    expect(jam.raw.state.availabilityAssignment[report.coreIndex]?.workReport).toEqual(report);

    const exactlyTwoThirds = await pending.assure({ votes: 4 });
    expect(exactlyTwoThirds.status).toBe("pending");
    expect(jam.raw.state.availabilityAssignment[report.coreIndex]).not.toBeNull();
    await expect(exactlyTwoThirds.accumulate()).rejects.toThrow("before it becomes available");

    const strictSupermajority = await pending.assure({ votes: 5 });
    expect(strictSupermajority.status).toBe("available");
    expect(strictSupermajority.availableReports).toEqual([report]);
    expect(jam.raw.state.availabilityAssignment[report.coreIndex]).toBeNull();

    const accumulation = await strictSupermajority.accumulate({ slot: 21 });
    accumulation.expect.serviceExecuted("counter");
    jam.expect.storage.u64("counter", "cntr", 1n);
  });

  test("surfaces protocol rejection details for an assurance with the wrong parent", async () => {
    const jam = await pipelineJam();
    const pipeline = await jam.pipeline();
    const pending = await pipeline.guarantee(pipeline.report({ service: "counter" }));

    await expect(
      pending.assure({
        votes: 5,
        parentHash: jam.hash("wrong-parent").asOpaque(),
      }),
    ).rejects.toThrow("InvalidAnchor");
  });
});
