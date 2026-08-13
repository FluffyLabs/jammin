# Testing JAM services

The jammin SDK runs service accumulation against an in-memory JAM state. `JamTest` is the recommended API for
service tests. It registers services by name, creates genesis state and work reports, applies state updates and
provides typed state assertions.

`TestJam` remains available as the low-level escape hatch for tests which need direct Typeberry objects.

## Setup

Build the project before running its tests:

```bash
jammin build
bun test
```

Install the test SDK when it is not already part of the project template:

```bash
bun add -d @fluffylabs/jammin-sdk
```

## Minimal service test

Declare the compiled service, submit a named report and inspect its state:

```typescript
import { test } from "bun:test";
import { JamTest, service } from "@fluffylabs/jammin-sdk";

test("counter increments", async () => {
  const jam = await JamTest.fromServices({
    counter: service("./dist/counter.jam", { id: 700 }),
  });

  const accumulation = await jam.accumulate({
    slot: 1,
    reports: [{ id: "increment-1", service: "counter" }],
  });

  accumulation.expect.serviceExecuted("counter");
  accumulation.expect.serviceCompleted("counter");
  jam.expect.storage.u64("counter", "cntr", 1n);
});
```

The test does not need to construct a `WorkReport`, hash service code, create genesis state or apply the resulting
state update. jammin derives those values from the service registry.

## Loading services

### Explicit declarations

`JamTest.fromServices()` accepts `.jam` paths, `Uint8Array` values and `BytesBlob` values:

```typescript
const jam = await JamTest.fromServices({
  buyer: service("./dist/buyer.jam", { id: 701 }),
  marketplace: service("./dist/marketplace.jam", {
    id: 702,
    info: { balance: 1_000_000n },
    storage: { mode: "open" },
  }),
});
```

Names are type-checked when the declaration is an object literal. IDs are optional; jammin assigns the lowest
unused ID. Duplicate IDs, missing binaries and unknown service names fail with a direct error.

### Current jammin project

`JamTest.create()` loads `jammin.build.yml`, deployment options and binaries from `dist/`:

```typescript
const jam = await JamTest.create();
```

`jammin build` also creates `config/jammin.test.config.ts` with a fresh high-level instance and the existing ID map:

```typescript
import { SERVICES, testJam } from "./config/jammin.test.config.js";

const counterByName = testJam.service("counter");
const counterById = testJam.service(SERVICES.counter.id);
```

Create a new `JamTest` in each test when state isolation matters. A `JamTest` is stateful by design.

## Reports

The one-result shorthand fills the service ID, current code hash, default gas and work-package hash:

```typescript
const report = jam.report({
  id: "purchase-1",
  service: "buyer",
  gas: 12_000_000n,
  output: new Uint8Array([1, 2, 3]),
});
```

`id` should be a stable, unique label within a scenario. If omitted, jammin assigns a local sequence label.

A report may contain several work results:

```typescript
const report = jam.report({
  id: "batch-1",
  results: [
    { service: "buyer", gas: 10_000_000n, output: "buy" },
    { service: "marketplace", gas: 8_000_000n, result: { type: "panic" } },
  ],
});
```

Accepted result statuses are `ok`, `panic`, `outOfGas`, `badCode`, `digestTooBig`,
`incorrectNumberOfExports` and `codeOversize`. Strings used as payloads, outputs and storage keys are encoded as
UTF-8. Use `Uint8Array` or `BytesBlob` for binary protocol data.

Low-level fields remain available when a scenario needs them:

```typescript
const report = jam.report({
  id: "anchored",
  service: "buyer",
  coreIndex: 1,
  context: { lookupAnchorSlot: Slot(42) },
  workPackageSpec: { hash: realWorkPackageHash },
});
```

## Atomic accumulation

`accumulate()` accepts high-level report configurations, reports returned by `jam.report()`, or a mixture of both.
It executes the transition and applies the state update before returning:

```typescript
const result = await jam.accumulate({
  slot: 3,
  reports: [
    { id: "buy", service: "buyer", output: purchase },
    jam.report({ id: "mint", service: "kitty", output: mint }),
  ],
  sequential: true,
  debug: false,
});
```

The remaining simulator options are `chainSpec`, `pvmBackend`, `entropy`, `sequential` and fine-grained `debug`
logging.

The returned object keeps the original transition result in `result.raw` and exposes a compact trace:

```typescript
for (const service of result.trace.executedServices) {
  console.log(service.name, service.workResults, service.gasUsed);
}

const statistics = result.statistics("buyer");
```

The trace describes total execution per service. Typeberry does not currently expose recursive transfer rounds as
structured transition output, so jammin does not infer round boundaries from logs.

## State readers and assertions

Read raw bytes, UTF-8 text, or fixed-width little-endian integers:

```typescript
const counter = jam.service("counter");

counter.storage.bytes("cntr");
counter.storage.text("mode");
counter.storage.u32("ownr");
counter.storage.u64("cntr");
counter.info();
```

Integer readers reject values with the wrong width instead of silently truncating them.

State assertions use the same names and encodings:

```typescript
jam.expect.storage.bytes("counter", "raw", [1, 2, 3]);
jam.expect.storage.text("counter", "mode", "open");
jam.expect.storage.u32("kitty", "ownr", 701);
jam.expect.storage.u64("counter", "cntr", 2n);
jam.expect.storage.missing("counter", "error");
```

Accumulation assertions distinguish actual PVM execution from a structurally valid result:

```typescript
result.expect.serviceExecuted("counter");
result.expect.serviceNotExecuted("marketplace");
result.expect.serviceCompleted("counter");
result.expect.serviceOutOfGas("counter");
```

`serviceCompleted` checks that the service consumed gas but stopped below the gas assigned by submitted reports.
`serviceOutOfGas` checks that it consumed the complete assigned amount.

## Testing rollback and checkpoints

The same `JamTest` can execute consecutive slots because every successful transition is applied to its state:

```typescript
const round = async (slot: number, expected: bigint, outOfGas = false) => {
  const result = await jam.accumulate({
    slot,
    reports: [{ id: `counter-${slot}`, service: "counter", gas: 5_000_000n }],
  });

  if (outOfGas) {
    result.expect.serviceOutOfGas("counter");
  } else {
    result.expect.serviceCompleted("counter");
  }
  jam.expect.storage.u64("counter", "cntr", expected);
};

await round(1, 1n);
await round(2, 2n);
await round(3, 2n, true); // uncheckpointed write is rolled back
await round(4, 3n, true); // write made before checkpoint survives
```

For larger scenarios, capture a checkpoint and explore independent branches:

```typescript
const funded = jam.snapshot("funded");

await testSuccessfulPurchase(jam);
jam.restore(funded);
await testRejectedPurchase(jam);

const competingBranch = await jam.fork(funded);
await testConcurrentPurchase(competingBranch);

jam.reset(); // back to the state created by fromServices()
```

Snapshots include JAM state, generated report IDs, accumulated history and dynamically discovered services. `fork()`
copies all of them; later writes in either branch do not affect the other branch. `jam.history` lists completed
accumulation traces in scenario order.

## Dynamically created services

After a successful `new_service` host call, jammin reads the created IDs from the state update and registers them as
`service-<id>`:

```typescript
const result = await jam.accumulate({
  slot: 10,
  reports: [{ service: "factory", output: createKitty }],
});

const created = result.createdServices[0];
if (created !== undefined) {
  jam.nameService(created.id, "kitty-1");
  jam.service("kitty-1").info();
}
```

`jam.createdServices` contains all services discovered since genesis. Naming a service makes subsequent reports,
state readers and assertions easier to follow.

## Guarantee, assurance and accumulation pipeline

Use `jam.pipeline()` when a test should exercise availability instead of injecting an already available report:

```typescript
const pipeline = await jam.pipeline();
const report = pipeline.report({
  id: "counter-through-availability",
  service: "counter",
  gas: 5_000_000n,
});

const pending = await pipeline.guarantee(report);
const fourOfSix = await pending.assure({ votes: 4 });
expect(fourOfSix.status).toBe("pending");

const fiveOfSix = await pending.assure({ votes: 5 });
expect(fiveOfSix.status).toBe("available");
await fiveOfSix.accumulate({ slot: 21 });
```

The pipeline runs Typeberry's real `Reports` and `Assurances` transitions. It creates deterministic development
validator keys, derives guarantor core assignments, signs the `jam_guarantee` and `jam_available` messages and
installs a valid recent anchor and authorizer pool. Protocol failures such as an invalid parent anchor are returned
with the Typeberry error name. The default vote count is the chain specification's strict supermajority.

## Refine work packages

`jam.workPackage()` keeps work-item order and derives service IDs, code hashes, extrinsic hashes and the canonical
work-package hash:

```typescript
const workPackage = jam.workPackage({
  authorizationService: "authorizer",
  context: {
    anchor: bestBlockHash,
    stateRoot: bestBlockStateRoot,
    beefyRoot,
    lookupAnchor: bestBlockHash,
    lookupAnchorSlot: bestBlockSlot,
  },
  items: [
    {
      service: "producer",
      payload: "produce",
      extrinsics: [inputBlob],
      exportCount: 2,
    },
    {
      service: "consumer",
      payload: "consume",
      imports: [{ treeRoot: previousExportsRoot, index: 7 }],
      exportCount: 1,
    },
  ],
});

const refined = await jam.refine(workPackage, {
  coreIndex: 0,
  backend: new TypeberryRpcRefineBackend("http://127.0.0.1:19800"),
});

refined.report;
refined.exports[0]; // two producer segments
refined.exports[1]; // one consumer segment
```

The RPC backend calls Typeberry's `typeberry_refineWorkPackage`, decodes the returned work report and splits its flat
export bytes back into per-work-item segments. It also rejects responses inconsistent with each item's
`exportCount`. The backend is an interface, so tests may inject an in-process backend without changing the work
package code. A package sent to a real node must use an anchor and state root present in that node's state database;
zero-valued context defaults are only useful for construction tests and custom backends.

Typeberry's current custom RPC does not fetch imported segment data from the DA layer yet. jammin encodes import
specifications correctly, but a work package that executes `fetch` for those imports needs a Typeberry backend with
import resolution (or a custom `JamRefineBackend`).

## Low-level escape hatch

Use `jam.raw` when testing protocol details which the high-level API deliberately does not hide:

```typescript
const serviceInfo = jam.raw.getServiceInfo(jam.services.counter.id);
const state = jam.raw.state;
```

The standalone `TestJam`, `createWorkReportAsync()`, `simulateAccumulation()` and `generateGuarantees()` APIs remain
available for existing tests and protocol-level work. Prefer `JamTest` for service behavior tests so the test stays
focused on inputs, execution and state changes.
