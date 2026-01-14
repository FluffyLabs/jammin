# JAM SDK

JAM SDK for e2e integration tests and object encoding.

## Installation

```bash
npm install @fluffylabs/jammin-sdk
```

## Work Report Module

The work report module provides helper functions for creating JAM work reports and related structures. These functions simplify the construction of work reports that validators submit to report the results of executing work packages.

### Overview

Work reports are a core component of the JAM protocol, submitted by validators to communicate the execution results of work packages. This SDK provides type-safe factory functions that handle:

- Automatic type validation and conversion using typeberry types
- Sensible defaults for optional parameters
- Hash computation and payload processing
- Proper structure assembly for JAM protocol compliance

### Core Functions

#### `createWorkResult`

Creates a `WorkResult` representing the outcome of a work item execution.

```typescript
import { hash } from "@typeberry/lib";
import { createWorkResult } from "@fluffylabs/jammin-sdk";

const blake2b = await hash.Blake2b.createHasher();

const result = createWorkResult(blake2b, {
  serviceId: 42,
  codeHash: myCodeHash,
  payload: myPayload,
  gas: 1000n,
  output: outputBlob,
  isError: false,
  load: {
    exportedSegments: 5,
    extrinsicCount: 10,
    extrinsicSize: 200,
    gasUsed: 500n,
    importedSegments: 3,
  },
});
```

**Parameters:**
- `blake2b` (`hash.Blake2b`): Blake2b hasher instance for computing payload hash
- `options`:
  - `serviceId` (required, `number`): The service identifier
  - `codeHash` (optional, `OpaqueHash`): Hash of the executed code. Defaults to `ZERO_HASH`
  - `payload` (optional, `BytesBlob`): Input payload for the work item. Defaults to empty blob
  - `gas` (optional, `bigint`): Gas allocated for execution. Defaults to `0n`
  - `output` (optional, `BytesBlob`): Execution output. Defaults to empty blob
  - `isError` (optional, `boolean`): Whether execution resulted in an error. Defaults to `false`
  - `load` (optional, `Partial<WorkRefineLoad>`): Resource usage metrics
    - `exportedSegments` (optional, `number`): Number of exported segments. Defaults to `0`
    - `extrinsicCount` (optional, `number`): Number of extrinsics. Defaults to `0`
    - `extrinsicSize` (optional, `number`): Total size of extrinsics. Defaults to `0`
    - `gasUsed` (optional, `bigint`): Gas consumed during execution. Defaults to `0n`
    - `importedSegments` (optional, `number`): Number of imported segments. Defaults to `0`

**Returns:** `WorkResult`

**Notes:**
- The function automatically computes the `payloadHash` using the provided Blake2b hasher
- When `isError` is `true`, the result will have kind `panic` with `okBlob` set to `null`
- When `isError` is `false`, the result will have kind `ok` with the provided output
- All numeric types are automatically validated and converted using typeberry's type helpers

---

#### `createRefineContext`

Creates a `RefineContext` specifying the blockchain state context for work package execution.

```typescript
import { createRefineContext } from "@fluffylabs/jammin-sdk";

const context = createRefineContext({
  anchor: anchorHash,
  stateRoot: stateRootHash,
  beefyRoot: beefyRootHash,
  lookupAnchor: lookupAnchorHash,
  lookupAnchorSlot: 100,
  prerequisites: [prereqHash1, prereqHash2],
});
```

**Parameters:**
- `options`:
  - `anchor` (optional, `OpaqueHash`): Anchor block hash. Defaults to `ZERO_HASH`
  - `stateRoot` (optional, `OpaqueHash`): State root hash. Defaults to `ZERO_HASH`
  - `beefyRoot` (optional, `OpaqueHash`): BEEFY root hash. Defaults to `ZERO_HASH`
  - `lookupAnchor` (optional, `OpaqueHash`): Lookup anchor hash. Defaults to `ZERO_HASH`
  - `lookupAnchorSlot` (optional, `number`): Lookup anchor time slot. Defaults to `0`
  - `prerequisites` (optional, `OpaqueHash[]`): Required prerequisite hashes. Defaults to `[]`

**Returns:** `RefineContext`

---

#### `createWorkPackageSpec`

Creates a `WorkPackageSpec` describing the specification of a work package.

```typescript
import { createWorkPackageSpec } from "@fluffylabs/jammin-sdk";

const spec = createWorkPackageSpec({
  hash: packageHash,
  length: 1024,
  erasureRoot: erasureRootHash,
  exportsRoot: exportsRootHash,
  exportsCount: 5,
});
```

**Parameters:**
- `options`:
  - `hash` (optional, `OpaqueHash`): Work package hash. Defaults to `ZERO_HASH`
  - `length` (optional, `number`): Package length in bytes. Defaults to `0`
  - `erasureRoot` (optional, `OpaqueHash`): Erasure coding root hash. Defaults to `ZERO_HASH`
  - `exportsRoot` (optional, `OpaqueHash`): Exports Merkle root. Defaults to `ZERO_HASH`
  - `exportsCount` (optional, `number`): Number of exports. Defaults to `0`

**Returns:** `WorkPackageSpec`

**Notes:**
- `length` is validated as a U32 value
- `exportsCount` is validated as a U16 value

---

#### `createWorkReport`

Creates a complete `WorkReport` for work package accumulation. This is the main entry point for constructing work reports to submit to the chain.

```typescript
import { bytes, hash } from "@typeberry/lib";
import { createWorkReport } from "@fluffylabs/jammin-sdk";

const blake2b = await hash.Blake2b.createHasher();

const report = createWorkReport(blake2b, {
  workPackageSpec: {
    hash: wpHash,
    length: 2048,
  },
  context: {
    anchor: anchorHash,
    lookupAnchorSlot: 42,
  },
  coreIndex: 5,
  authorizerHash: authHash,
  authorizationOutput: authOutput,
  results: [
    { serviceId: 1, gas: 100n },
    { serviceId: 2, gas: 200n, isError: true },
  ],
  authorizationGasUsed: 50n,
});
```

**Parameters:**
- `blake2b` (`hash.Blake2b`): Blake2b hasher instance for hashing work result payloads
- `options`:
  - `results` (required, `array`): Array of work result specifications. Each element is passed to `createWorkResult`. Must contain 1-16 results.
  - `workPackageSpec` (optional): Work package specification options (passed to `createWorkPackageSpec`)
  - `context` (optional): Blockchain state context options (passed to `createRefineContext`)
  - `coreIndex` (optional, `number`): Core index that processed the work. Defaults to `0`
  - `authorizerHash` (optional, `OpaqueHash`): Hash of the authorizer code. Defaults to `ZERO_HASH`
  - `authorizationOutput` (optional, `BytesBlob`): Output from authorization. Defaults to empty blob
  - `segmentRootLookup` (optional, `WorkPackageInfo[]`): Segment root lookup table. Defaults to `[]`
  - `authorizationGasUsed` (optional, `bigint`): Gas used during authorization. Defaults to `0n`

**Returns:** `WorkReport`

**Notes:**
- This function composes all other helper functions to create a complete work report
- The `results` array is automatically wrapped in a `FixedSizeArray` with proper validation
- Each result specification in the `results` array is processed through `createWorkResult`
- The work package spec is created via `createWorkPackageSpec`
- The context is created via `createRefineContext`

---

### Complete Example

```typescript
import { bytes, hash } from "@typeberry/lib";
import { createWorkReport } from "@fluffylabs/jammin-sdk";

async function buildWorkReport() {
  // Initialize Blake2b hasher
  const blake2b = await hash.Blake2b.createHasher();

  // Create some example data
  const wpHash = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([1])));
  const anchorHash = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([2])));
  const stateRootHash = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([3])));
  const authHash = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([4])));
  const codeHash = blake2b.hashBytes(bytes.BytesBlob.blobFrom(new Uint8Array([5])));
  const payload = bytes.BytesBlob.blobFrom(new Uint8Array([6, 7, 8]));

  // Create a complete work report
  const report = createWorkReport(blake2b, {
    workPackageSpec: {
      hash: wpHash,
      length: 4096,
      exportsCount: 10,
    },
    context: {
      anchor: anchorHash,
      stateRoot: stateRootHash,
      lookupAnchorSlot: 100,
    },
    coreIndex: 3,
    authorizerHash: authHash,
    authorizationOutput: bytes.BytesBlob.blobFrom(new Uint8Array([1, 2, 3, 4])),
    results: [
      {
        serviceId: 1,
        codeHash: codeHash,
        payload: payload,
        gas: 1000n,
        load: {
          exportedSegments: 2,
          extrinsicCount: 5,
          extrinsicSize: 100,
          gasUsed: 800n,
          importedSegments: 1,
        },
      },
      {
        serviceId: 2,
        isError: true,
        gas: 500n,
      },
    ],
    authorizationGasUsed: 200n,
  });

  return report;
}
```

### Type Safety

All functions leverage typeberry's type system for automatic validation and conversion:

- **Numeric types** are validated using `tryAsU32`, `tryAsU16`, `tryAsServiceId`, `tryAsServiceGas`, `tryAsCoreIndex`, etc.
- **Hash parameters** default to `ZERO_HASH` when not provided
- **Numeric parameters** default to `0` or `0n` (for bigint)
- **Array parameters** default to empty arrays
- **Blob parameters** default to empty `BytesBlob` instances

This ensures that:
- Invalid numeric values throw clear errors
- All required type constraints are enforced
- Protocol-compliant structures are always produced

### Error Handling

The functions will throw errors in the following cases:

- **Invalid numeric ranges**: When a number exceeds the valid range for its type (e.g., U32, U16)
- **Invalid work items count**: The `results` array must contain 1-16 items
- **Type conversion failures**: When typeberry's validation fails

Example error:
```
Assertion failure: WorkItemsCount: Expected '1 <= count <= 16' got 0
```

## Testing

Comprehensive tests are provided in `work-report.test.ts`:

```bash
bun test packages/jammin-sdk/work-report.test.ts
```

The test suite covers:
- Creating work results with minimal and full options
- Error results (panic mode)
- Payload hash computation
- Partial load options with defaults
- Refine context creation
- Work package spec creation
- Complete work report assembly with all components

## Building

```bash
npm run build
```

## Dependencies

This package depends on `@typeberry/lib` for core JAM types and utilities.

## License

MPL-2.0
