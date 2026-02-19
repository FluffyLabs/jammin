# Testing JAM Services

This guide covers how to write integration tests for JAM services using the jammin SDK testing utilities.

## Overview

The jammin SDK provides a comprehensive testing framework for simulating JAM accumulation in your test environment. The core of this framework is the `TestJam` class, which provides a fluent API for creating work reports, running accumulation, and inspecting state changes.

## Setup

### Prerequisites

Before writing tests, ensure your services are built:

```bash
jammin build
```

This generates service binaries and creates `config/jammin.test.config.ts` with type-safe service mappings for use in tests.

### Installation

The testing utilities are included in the `@fluffylabs/jammin-sdk` package:

```bash
bun add -d @fluffylabs/jammin-sdk
```

### Basic Test Structure

Here's a minimal test using Bun's built-in test runner with custom assertions:

```typescript
import { test } from "bun:test";
import {
  CoreId,
  createWorkReportAsync,
  expectAccumulationSuccess,
  Gas,
  TestJam,
} from "@fluffylabs/jammin-sdk";
import { SERVICES, testJam } from "../config/jammin.test.config";

test("should process work report", async () => {
  // Create a work report
  const report = await createWorkReportAsync({
    results: [{ serviceId: SERVICES.test.id, gas: Gas(1000n) }],
  });

  // Execute accumulation
  const result = await testJam.withWorkReport(report).accumulate();

  // Use custom assertion helper
  expectAccumulationSuccess(result);
});
```

## TestJam Class

The `TestJam` class is the main entry point for testing JAM services. It manages state, work reports, and accumulation execution.

### Creating a TestJam Instance

#### With Loaded Services

```typescript
// Loads all services from your project's jammin.build.yml files
const jam = await TestJam.create();
```

This is the recommended approach for most tests as it automatically discovers and loads your service configurations.

#### With Empty State

```typescript
// Creates an empty state with no services
const jam = TestJam.empty();
```

Useful for testing edge cases or when you don't need any services.

### Using Generated Service Configuration

After building your project with `jammin build`, a type-safe configuration file is automatically generated at `config/jammin.test.config.ts`. This file provides convenient mappings and a pre-configured TestJam instance:

#### Option 1: Use Pre-configured TestJam Instance

The simplest approach - the generated config includes a ready-to-use TestJam instance:

```typescript
import { testJam, SERVICES } from "./config/jammin.test.config.js";

test("should process work report for auth service", async () => {
  // testJam is already created with all services loaded
  const report = await createWorkReportAsync({
    results: [{ serviceId: SERVICES.auth.id, gas: Gas(1000n) }],
  });

  const result = await testJam.withWorkReport(report).accumulate();
  expectAccumulationSuccess(result);
});
```

#### Option 2: Create Individual TestJam Instances

For test isolation, create a new instance in each test:

```typescript
import { SERVICES } from "./config/jammin.test.config.js";

test("should process work report for auth service", async () => {
  const jam = await TestJam.create();

  // Use the type-safe service mapping
  const report = await createWorkReportAsync({
    results: [{ serviceId: SERVICES.auth.id, gas: Gas(1000n) }],
  });

  const result = await jam.withWorkReport(report).accumulate();
  expectAccumulationSuccess(result);
});
```

The generated configuration includes:
- `testJam` - Pre-configured TestJam instance with all services loaded (use for simplicity)
- `SERVICES` - Type-safe mapping of service names to IDs
- `TEST_CHAIN_SPEC` - Pre-configured chain specification

### Adding Work Reports

Work reports can be added using the fluent `withWorkReport()` API:

```typescript
const report = await createWorkReportAsync({
  results: [
    { serviceId: SERVICES.auth.id, gas: Gas(1000n) },
    { serviceId: SERVICES.bank.id, gas: Gas(2000n) },
  ],
});

const result = await jam.withWorkReport(report).accumulate();
```

#### Multiple Work Reports

Chain multiple `withWorkReport()` calls to process multiple reports in a single accumulation:

```typescript
const report1 = await createWorkReportAsync({
  results: [{ serviceId: SERVICES.auth.id, gas: Gas(1000n) }],
});

const report2 = await createWorkReportAsync({
  results: [{ serviceId: SERVICES.bank.id, gas: Gas(2000n) }],
});

const result = await jam
  .withWorkReport(report1)
  .withWorkReport(report2)
  .accumulate();

console.log(`Processed ${result.accumulationStatistics.size} work items`);
```

### Configuring Accumulation Options

Use `withOptions()` to configure accumulation behavior:

```typescript
import { PvmBackend } from "@fluffylabs/jammin-sdk/config";

const result = await jam
  .withWorkReport(report)
  .withOptions({
    slot: Slot(100),           // Custom time slot
    debug: true,               // Enable debug logging
    pvmBackend: PvmBackend.BuiltIn,  // Use built-in PVM
    sequential: true,          // Sequential accumulation (default)
  })
  .accumulate();
```

#### Available Options

- `slot?: TimeSlot` - Time slot for accumulation (defaults to state's current timeslot)
- `debug?: boolean | DebugLoggingOptions` - Enable debug logging (can be a boolean for all logs, or an object for fine-grained control)
- `pvmBackend?: PvmBackend` - PVM backend to use (`PvmBackend.Ananas` or `PvmBackend.BuiltIn`)
- `sequential?: boolean` - Use sequential accumulation mode (default: `true`)
- `entropy?: EntropyHash` - Entropy for randomness (defaults to zero hash for deterministic tests)
- `chainSpec?: ChainSpec` - Chain specification to use

### Querying State

After accumulation, you can query the service state:

#### Get Service Info

```typescript
const info = jam.getServiceInfo(SERVICES.auth.id);
console.log(`Balance: ${info?.balance}`);
console.log(`Code hash: ${info?.codeHash}`);
```

#### Get Service Storage

```typescript
const key = TestJam.stringToBlob("testKey");
const value = jam.getServiceStorage(SERVICES.auth.id, key);
```

#### Get Preimage Data

```typescript
const preimage = jam.getServicePreimage(SERVICES.auth.id, someHash);
```

## Creating Work Reports

The SDK provides flexible utilities for creating work reports with varying levels of detail.

### Simple Work Report

```typescript
import { createWorkReportAsync, Gas } from "@fluffylabs/jammin-sdk";

const report = await createWorkReportAsync({
  results: [
    { serviceId: SERVICES.auth.id, gas: Gas(1000n) },
  ],
});
```

### Work Report with Multiple Work Items

```typescript
const report = await createWorkReportAsync({
  results: [
    { 
      serviceId: SERVICES.auth.id, 
      gas: Gas(1000n),
      result: { type: "ok", output: TestJam.numbersToBlob([1, 2, 3]) }
    },
    { 
      serviceId: SERVICES.auth.id, 
      gas: Gas(2000n),
      result: { type: "ok" }
    },
    { 
      serviceId: SERVICES.auth.id, 
      gas: Gas(500n),
      result: { type: "panic" }  // Simulate a panic
    },
  ],
});
```

### Work Report with Custom Configuration

```typescript
import { CoreId, Slot } from "@fluffylabs/jammin-sdk";

const report = await createWorkReportAsync({
  coreIndex: CoreId(5),
  results: [
    {
      serviceId: SERVICES.auth.id,
      gas: Gas(1000n),
      payload: TestJam.numbersToBlob([4, 5, 6]),
    },
  ],
  context: {
    lookupAnchorSlot: Slot(42),
  },
});
```

### Work Result Types

Work results can have different status types:

```typescript
// Successful execution
{ type: "ok", output: TestJam.hexToBlob("0xaabbccdd") }

// Execution errors
{ type: "panic" }
{ type: "outOfGas" }
{ type: "badCode" }
{ type: "digestTooBig" }
{ type: "incorrectNumberOfExports" }
{ type: "codeOversize" }
```

## Testing Helpers

The SDK provides assertion helpers to simplify test writing.

### expectAccumulationSuccess

Assert that accumulation completed with a valid structure:

```typescript
import { expectAccumulationSuccess } from "@fluffylabs/jammin-sdk/testing-helpers";

const result = await jam.withWorkReport(report).accumulate();
expectAccumulationSuccess(result);  // Throws if result is invalid
```

### expectStateChange

Assert that state changed according to a predicate:

```typescript
import { expectStateChange } from "@fluffylabs/jammin-sdk/testing-helpers";

const beforeBalance = jam.getServiceInfo(SERVICES.auth.id)?.balance;

await jam.withWorkReport(report).accumulate();

const afterBalance = jam.getServiceInfo(SERVICES.auth.id)?.balance;

expectStateChange(
  beforeBalance,
  afterBalance,
  (before, after) => after !== undefined && before !== undefined && after > before,
  "Balance should increase"
);
```

### expectServiceInfoChange

Specialized helper for validating service account changes:

```typescript
import { expectServiceInfoChange } from "@fluffylabs/jammin-sdk/testing-helpers";

const before = jam.getServiceInfo(SERVICES.auth.id);
await jam.withWorkReport(report).accumulate();
const after = jam.getServiceInfo(SERVICES.auth.id);

expectServiceInfoChange(
  before,
  after,
  (b, a) => a && b && a.balance > b.balance,
  "Service should consume gas"
);
```

## Common Test Patterns

### Testing Service Execution

```typescript
import { test, expect } from "bun:test";
import {createWorkReportAsync, Gas } from "@fluffylabs/jammin-sdk";
import { expectAccumulationSuccess } from "@fluffylabs/jammin-sdk/testing-helpers";
import { testJam, SERVICES } from "./config/jammin.test.config.js";

test("service should execute successfully", async () => {
  const report = await createWorkReportAsync({
    results: [{ serviceId: SERVICES.auth.id, gas: Gas(100000n) }],
  });

  const result = await testJam.withWorkReport(report).accumulate();

  expectAccumulationSuccess(result);
});
```

### Testing State Changes

```typescript
import { test, expect } from "bun:test";
import { createWorkReportAsync, Gas, TestJam } from "@fluffylabs/jammin-sdk";
import { testJam as jam, SERVICES } from "./config/jammin.test.config.js";

test("service storage should update", async () => {
  const authId = SERVICES.auth.id;

  const storageKey = TestJam.stringToBlob("myKey");
  const beforeValue = jam.getServiceStorage(authId, storageKey);

  const report = await createWorkReportAsync({
    results: [{ serviceId: authId, gas: Gas(50000n) }],
  });

  await jam.withWorkReport(report).accumulate();

  const afterValue = jam.getServiceStorage(authId, storageKey);
  expect(afterValue).not.toEqual(beforeValue);
});
```

### Testing Multiple Services

```typescript
import { test, expect } from "bun:test";
import { createWorkReportAsync, Gas } from "@fluffylabs/jammin-sdk";
import { expectAccumulationSuccess } from "@fluffylabs/jammin-sdk/testing-helpers";
import { testJam as jam, SERVICES } from "./config/jammin.test.config.js";

test("should process multiple services", async () => {
  const report = await createWorkReportAsync({
    results: [
      { serviceId: SERVICES.auth.id, gas: Gas(10000n) },
      { serviceId: SERVICES.bank.id, gas: Gas(20000n) },
      { serviceId: SERVICES.exchange.id, gas: Gas(15000n) },
    ],
  });

  const result = await jam.withWorkReport(report).accumulate();

  expectAccumulationSuccess(result);
});
```

### Testing Error Conditions

```typescript
import { test, expect } from "bun:test";
import { createWorkReportAsync, Gas } from "@fluffylabs/jammin-sdk";
import { expectAccumulationSuccess } from "@fluffylabs/jammin-sdk/testing-helpers";
import { testJam as jam, SERVICES } from "./config/jammin.test.config.js";

test("should handle panic gracefully", async () => {
  const report = await createWorkReportAsync({
    results: [
      { 
        serviceId: ServiceId(0), 
        gas: Gas(1000n),
        result: { type: "panic" }
      },
    ],
  });

  const result = await jam.withWorkReport(report).accumulate();

  expectAccumulationSuccess(result);
});
```

## Troubleshooting

### Service Not Found

If you see errors like "Service with id X not found", ensure that:

1. Your `jammin.build.yml` file is properly configured
2. You've run `jammin build` command
3. You're using `SERVICES` from generated `config/jammin.test.config.js`;

### Type Errors with Branded Types

The SDK uses branded types for safety. Use the helper functions to create them:

```typescript
import { ServiceId, Gas, CoreId, Slot, U32 } from "@fluffylabs/jammin-sdk";

// Correct
const serviceId = ServiceId(0);
const gas = Gas(1000n);
const coreId = CoreId(5);
const slot = Slot(100);
const value = U32(42);

// Incorrect - will cause type errors
const serviceId = 0;  // Type error
const gas = 1000n;    // Type error
```

### Debug Logging

Enable debug logging to see what's happening during accumulation:

```typescript
const result = await jam
  .withWorkReport(report)
  .withOptions({ debug: true })
  .accumulate();
```

This will output detailed logs including:
- Accumulation steps
- PVM host calls

#### Fine-Grained Logging Control

You can enable only specific log categories for more focused debugging:

```typescript
// Enable only ecalli traces
const result = await jam
  .withWorkReport(report)
  .withOptions({
    debug: {
      ecalliTrace: true,
    },
  })
  .accumulate();
```

Available debug options:
- `pvmExecution` - PVM (Polkadot Virtual Machine) execution details including instruction traces and memory access patterns
- `ecalliTrace` - Ecalli (host call) traces for service execution and debugging service interactions
- `hostCalls` - Host calls made during service execution
- `accumulate` - Accumulation process details and state transitions showing how work items are processed
- `safrole` - Safrole (randomness and validator selection) operations for consensus-related debugging
- `refine` - Refinement process for work reports including validation and processing
- `stateTransitions` - State transitions and state root changes during processing

### State Not Persisting

Remember that `accumulate()` automatically applies state updates. If you need to inspect state at different points:

```typescript
// Check initial state
const initialInfo = jam.getServiceInfo(SERVICES.auth.id);

// Run first accumulation (state is updated)
await jam.withWorkReport(report1).accumulate();

// Check intermediate state
const midInfo = jam.getServiceInfo(SERVICES.auth.id);

// Run second accumulation (state is updated again)
await jam.withWorkReport(report2).accumulate();

// Check final state
const finalInfo = jam.getServiceInfo(SERVICES.auth.id);
```

## Advanced Usage

### Custom Blake2b Hasher

For more control over work report creation:

```typescript
import { Blake2b } from "@fluffylabs/jammin-sdk/hash";
import { createWorkReport } from "@fluffylabs/jammin-sdk";

const blake2b = await Blake2b.createHasher();

const report = createWorkReport(blake2b, {
  results: [{ serviceId: SERVICES.auth.id, gas: Gas(1000n) }],
});
```

### Manual State Management

For advanced use cases, you can manually manage state:

```typescript
import { generateState, loadServices } from "@fluffylabs/jammin-sdk";

const services = await loadServices();
const state = generateState(services);

// Use state directly with simulateAccumulation
import { simulateAccumulation } from "@fluffylabs/jammin-sdk";

const result = await simulateAccumulation(state, [report], {
  debug: true,
});
```

### Custom Chain Specifications

Override the default chain spec:

```typescript
import { tinyChainSpec } from "@fluffylabs/jammin-sdk/config";

const customSpec = {
  ...tinyChainSpec,
  // Customize as needed
};

const result = await jam
  .withWorkReport(report)
  .withOptions({ chainSpec: customSpec })
  .accumulate();
```

## Best Practices

1. **Use `testJam` by default** - It automatically loads your services
2. **Use preconfigured `SERVICES` instead of manually writing service ids** - It prevents changing tests when reassigning
   service ids
3. **Chain method calls** - The fluent API makes tests more readable
4. **Use helper assertions** - They provide better error messages than raw `expect()`
5. **Test state changes explicitly** - Don't assume accumulation modified state
6. **Use branded types** - They prevent common mistakes with raw numbers
7. **Enable debug logging when troubleshooting** - It shows exactly what's happening
8. **Test both success and failure cases** - Include tests for panics and out-of-gas scenarios

## Next Steps

- Review the [Service SDK examples](service-examples.md) for service implementation patterns
- Explore the [jammin suite](bootstrap/jammin-suite.md) for more tools and features
