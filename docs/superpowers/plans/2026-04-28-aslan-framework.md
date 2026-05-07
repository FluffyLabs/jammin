# as-lan Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register as-lan as a built-in SDK in jammin so users can write `sdk: as-lan` (or `sdk: as-lan-0.0.4` / `sdk: aslan-0.0.4`) in `jammin.build.yml` instead of inlining the docker image and build/test commands.

**Architecture:** Add a single canonical entry `aslan-0.0.4` to the existing `SDK_CONFIGS` map. Add a separate `SDK_ALIASES` map and a `resolveSdkId` helper next to it. Build-command and test-command call the helper before looking up `SDK_CONFIGS`. The Zod validator accepts both canonical keys and alias keys. A new `aslan` entry is added to the create-command template registry.

**Tech Stack:** TypeScript, Bun (runtime + test runner), Zod (validation), Biome (lint/format), Commander (CLI).

**Spec:** `docs/superpowers/specs/2026-04-28-aslan-framework-design.md`

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `packages/jammin-sdk/config/sdk-configs.ts` | modify | New `aslan-0.0.4` entry, new `SDK_ALIASES` map, new `resolveSdkId` helper |
| `packages/jammin-sdk/config/sdk-configs.test.ts` | create | `resolveSdkId` unit tests |
| `packages/jammin-sdk/config/types/config.ts` | modify | Widen `ServiceConfig.sdk` to include alias keys |
| `packages/jammin-sdk/config/config-validator.ts` | modify | Accept alias keys in Zod schema; refresh error message |
| `packages/jammin-sdk/config/config-validator.test.ts` | modify | Add tests for alias acceptance / rejection |
| `bin/cli/src/commands/build-command.ts` | modify | Resolve string SDK ids via `resolveSdkId` before `SDK_CONFIGS` lookup |
| `bin/cli/src/commands/build-command.test.ts` | modify | Add a docker-command test using the `as-lan` alias |
| `bin/cli/src/commands/test-command.ts` | modify | Same resolver swap as build-command |
| `bin/cli/src/commands/create-command.ts` | modify | Register `aslan` template |
| `docs/src/service-examples.md` | modify | New "as-lan" docker section |

---

## Task 1: Register `aslan-0.0.4` in `SDK_CONFIGS`

**Files:**
- Modify: `packages/jammin-sdk/config/sdk-configs.ts`

The validator's Zod enum is built from `Object.keys(SDK_CONFIGS)`, so adding the entry alone makes `sdk: aslan-0.0.4` accepted by the validator. We assert that with a focused validator test before changing any code.

- [ ] **Step 1: Add a failing validator test for the canonical `aslan-0.0.4` key**

Append to `packages/jammin-sdk/config/config-validator.test.ts`, inside the existing `describe("Validate Build Config", ...)` block (after the "Should reject inline custom SDK with empty strings" test, before the `Deployment Config Validation` describe block):

```typescript
test("Should accept canonical aslan-0.0.4 SDK", () => {
  const config = {
    services: [
      {
        path: "./services/example",
        name: "example",
        sdk: "aslan-0.0.4",
      },
    ],
  };

  const result = validateBuildConfig(config);
  expect(result.services[0]?.sdk).toBe("aslan-0.0.4");
});
```

- [ ] **Step 2: Run the new test, expect it to fail**

```bash
bun test packages/jammin-sdk/config/config-validator.test.ts -t "Should accept canonical aslan-0.0.4 SDK"
```

Expected: FAIL — Zod rejects `aslan-0.0.4` because it's not in the enum yet.

- [ ] **Step 3: Add the `aslan-0.0.4` entry to `SDK_CONFIGS`**

In `packages/jammin-sdk/config/sdk-configs.ts`, append a new entry after the `jamc3-1.1.2` entry (before the closing `}`):

```typescript
import type { SdkConfig } from "./types/config.js";

export const SDK_CONFIGS = {
  "jam-sdk-0.1.26": {
    image: "ghcr.io/fluffylabs/jammin-jam-sdk:0.1.26",
    build: "jam-pvm-build -m service",
    test: "cargo test",
  },
  "jambrains-1cfc41c": {
    image:
      "ghcr.io/jambrains/service-sdk:latest@sha256:1cfc41c23f5c348aaee5f5c70aaa24f10c26baf903de4b4f6774e2032820ba87",
    build: "single-file main.c",
    test: "true",
  },
  "jade-0.0.15-pre.1": {
    image: "ghcr.io/fluffylabs/jammin-jade:0.0.15-pre.1",
    build: "build",
    test: "test",
  },
  "ajanta-0.1.0": {
    image: "ghcr.io/fluffylabs/jammin-ajanta:0.1.0",
    build: "ajanta build main.py -o service.jam",
    test: "true",
  },
  "jamc3-1.1.2": {
    image: "ghcr.io/dreverr/jamc3:1.1.2",
    build: "main.c3 -o service.jam",
    test: "bun test",
  },
  "aslan-0.0.4": {
    image: "ghcr.io/tomusdrw/jammin-as-lan:0.0.4",
    build: "npm run build",
    test: "npm test",
  },
} as const satisfies Record<string, SdkConfig>;
```

- [ ] **Step 4: Run the validator tests, expect all to pass**

```bash
bun test packages/jammin-sdk/config/config-validator.test.ts
```

Expected: PASS for the new test plus all previously-passing tests.

- [ ] **Step 5: Commit**

```bash
git add packages/jammin-sdk/config/sdk-configs.ts packages/jammin-sdk/config/config-validator.test.ts
git commit -m "Add aslan-0.0.4 entry to SDK_CONFIGS"
```

---

## Task 2: Add `SDK_ALIASES` map and `resolveSdkId` helper

**Files:**
- Modify: `packages/jammin-sdk/config/sdk-configs.ts`
- Create: `packages/jammin-sdk/config/sdk-configs.test.ts`

The helper resolves any accepted string SDK identifier (canonical key or alias) to a canonical `SDK_CONFIGS` key, returning `undefined` for unknown strings. It does NOT handle the `SdkConfig` object form — that's a structurally-different value handled by the caller.

- [ ] **Step 1: Write failing tests for `SDK_ALIASES` shape and `resolveSdkId` behaviour**

Create `packages/jammin-sdk/config/sdk-configs.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { resolveSdkId, SDK_ALIASES, SDK_CONFIGS } from "./sdk-configs.js";

describe("SDK_ALIASES", () => {
  test("Every alias target points to a canonical SDK_CONFIGS key", () => {
    for (const target of Object.values(SDK_ALIASES)) {
      expect(SDK_CONFIGS).toHaveProperty(target);
    }
  });

  test("Bare 'as-lan' alias resolves to aslan-0.0.4", () => {
    expect(SDK_ALIASES["as-lan"]).toBe("aslan-0.0.4");
  });

  test("Versioned 'as-lan-0.0.4' alias resolves to aslan-0.0.4", () => {
    expect(SDK_ALIASES["as-lan-0.0.4"]).toBe("aslan-0.0.4");
  });
});

describe("resolveSdkId", () => {
  test("Returns the input when it is already a canonical SDK_CONFIGS key", () => {
    expect(resolveSdkId("aslan-0.0.4")).toBe("aslan-0.0.4");
    expect(resolveSdkId("jam-sdk-0.1.26")).toBe("jam-sdk-0.1.26");
  });

  test("Resolves the bare 'as-lan' alias to aslan-0.0.4", () => {
    expect(resolveSdkId("as-lan")).toBe("aslan-0.0.4");
  });

  test("Resolves the versioned 'as-lan-0.0.4' alias to aslan-0.0.4", () => {
    expect(resolveSdkId("as-lan-0.0.4")).toBe("aslan-0.0.4");
  });

  test("Returns undefined for unknown identifiers", () => {
    expect(resolveSdkId("nonsense")).toBeUndefined();
    expect(resolveSdkId("as-lan-0.0.3")).toBeUndefined();
    expect(resolveSdkId("aslan")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the new tests, expect them to fail**

```bash
bun test packages/jammin-sdk/config/sdk-configs.test.ts
```

Expected: FAIL — `SDK_ALIASES` and `resolveSdkId` aren't exported yet.

- [ ] **Step 3: Add `SDK_ALIASES` and `resolveSdkId` to `sdk-configs.ts`**

Append to `packages/jammin-sdk/config/sdk-configs.ts` after the `SDK_CONFIGS` declaration:

```typescript
export const SDK_ALIASES = {
  "as-lan": "aslan-0.0.4",
  "as-lan-0.0.4": "aslan-0.0.4",
} as const satisfies Record<string, keyof typeof SDK_CONFIGS>;

/**
 * Resolve a string SDK identifier (canonical key or alias) to a canonical
 * SDK_CONFIGS key. Returns undefined for unknown identifiers.
 */
export function resolveSdkId(id: string): keyof typeof SDK_CONFIGS | undefined {
  if (id in SDK_CONFIGS) {
    return id as keyof typeof SDK_CONFIGS;
  }
  if (id in SDK_ALIASES) {
    return SDK_ALIASES[id as keyof typeof SDK_ALIASES];
  }
  return undefined;
}
```

- [ ] **Step 4: Run the new tests, expect them to pass**

```bash
bun test packages/jammin-sdk/config/sdk-configs.test.ts
```

Expected: PASS for all four `resolveSdkId` tests and the three `SDK_ALIASES` tests.

- [ ] **Step 5: Commit**

```bash
git add packages/jammin-sdk/config/sdk-configs.ts packages/jammin-sdk/config/sdk-configs.test.ts
git commit -m "Add SDK_ALIASES map and resolveSdkId helper"
```

---

## Task 3: Widen `ServiceConfig.sdk` type to include alias keys

**Files:**
- Modify: `packages/jammin-sdk/config/types/config.ts`

This is a type-only change. It lets TypeScript users construct `ServiceConfig` objects with alias strings (e.g. in tests, or in callers building config objects in code). Runtime behaviour is unchanged.

- [ ] **Step 1: Add a failing type-level assertion test**

Two edits to `packages/jammin-sdk/config/sdk-configs.test.ts`:

(a) Add this import line at the top of the file, alongside the existing imports:

```typescript
import type { ServiceConfig } from "./types/config.js";
```

(b) Append a new `describe` block after the existing `describe("resolveSdkId", ...)` block:

```typescript
describe("ServiceConfig.sdk type accepts alias strings", () => {
  test("Compiles when sdk is an alias key", () => {
    const cfg: ServiceConfig = {
      path: "./services/example",
      name: "example",
      sdk: "as-lan",
    };
    expect(cfg.sdk).toBe("as-lan");
  });

  test("Compiles when sdk is a versioned alias key", () => {
    const cfg: ServiceConfig = {
      path: "./services/example",
      name: "example",
      sdk: "as-lan-0.0.4",
    };
    expect(cfg.sdk).toBe("as-lan-0.0.4");
  });
});
```

- [ ] **Step 2: Run the new test file, expect type errors**

```bash
bun test packages/jammin-sdk/config/sdk-configs.test.ts
```

Expected: FAIL with TypeScript errors like `Type '"as-lan"' is not assignable to type ...`.

- [ ] **Step 3: Widen `ServiceConfig.sdk`**

Edit `packages/jammin-sdk/config/types/config.ts`. Change the import line to include `SDK_ALIASES`:

```typescript
import type { SDK_ALIASES, SDK_CONFIGS } from "../sdk-configs.js";
```

And change the `sdk` field on the `ServiceConfig` interface from:

```typescript
sdk: keyof typeof SDK_CONFIGS | SdkConfig;
```

to:

```typescript
sdk: keyof typeof SDK_CONFIGS | keyof typeof SDK_ALIASES | SdkConfig;
```

- [ ] **Step 4: Run the file's tests, expect pass**

```bash
bun test packages/jammin-sdk/config/sdk-configs.test.ts
```

Expected: PASS for all tests, no type errors.

- [ ] **Step 5: Run the project-wide type check + lint to catch any consumer that broke**

```bash
bun run qa
```

Expected: PASS. (If a consumer was narrowing the old type, fix locally — none expected based on the spec, but check.)

- [ ] **Step 6: Commit**

```bash
git add packages/jammin-sdk/config/types/config.ts packages/jammin-sdk/config/sdk-configs.test.ts
git commit -m "Widen ServiceConfig.sdk type to accept alias keys"
```

---

## Task 4: Validator accepts alias keys

**Files:**
- Modify: `packages/jammin-sdk/config/config-validator.ts`
- Modify: `packages/jammin-sdk/config/config-validator.test.ts`

The Zod schema needs to accept `as-lan` and `as-lan-0.0.4` in addition to the canonical keys. The error message lists both sets so users can debug typos.

- [ ] **Step 1: Add failing alias-acceptance tests**

Append to `packages/jammin-sdk/config/config-validator.test.ts`, inside the existing `describe("Validate Build Config", ...)` block, near the `aslan-0.0.4` test added in Task 1:

```typescript
test("Should accept bare 'as-lan' alias as SDK", () => {
  const config = {
    services: [
      {
        path: "./services/example",
        name: "example",
        sdk: "as-lan",
      },
    ],
  };

  const result = validateBuildConfig(config);
  expect(result.services[0]?.sdk).toBe("as-lan");
});

test("Should accept versioned 'as-lan-0.0.4' alias as SDK", () => {
  const config = {
    services: [
      {
        path: "./services/example",
        name: "example",
        sdk: "as-lan-0.0.4",
      },
    ],
  };

  const result = validateBuildConfig(config);
  expect(result.services[0]?.sdk).toBe("as-lan-0.0.4");
});

test("Should reject unknown 'as-lan-0.0.3' alias", () => {
  const config = {
    services: [
      {
        path: "./services/example",
        name: "example",
        sdk: "as-lan-0.0.3",
      },
    ],
  };

  expect(() => validateBuildConfig(config)).toThrow();
});

test("Should reject misspelt canonical 'aslan' (no version)", () => {
  const config = {
    services: [
      {
        path: "./services/example",
        name: "example",
        sdk: "aslan",
      },
    ],
  };

  expect(() => validateBuildConfig(config)).toThrow();
});
```

- [ ] **Step 2: Run the new tests, expect the alias-acceptance ones to fail**

```bash
bun test packages/jammin-sdk/config/config-validator.test.ts -t "alias"
```

Expected: FAIL on the two acceptance tests (validator currently rejects alias strings); PASS on the two rejection tests (validator already rejects unknown strings).

- [ ] **Step 3: Update the validator to accept aliases**

Edit `packages/jammin-sdk/config/config-validator.ts`. Change the import line at the top:

```typescript
import { SDK_ALIASES, SDK_CONFIGS } from "./sdk-configs.js";
```

Replace the `ServiceConfigSchema` `sdk` field's union (currently around lines 32-35):

```typescript
sdk: z.union(
  [z.enum(Object.keys(SDK_CONFIGS) as (keyof typeof SDK_CONFIGS)[]), SdkConfigSchema],
  `Expected a valid custom SDK configuration or one of the supported SDK ids (${Object.keys(SDK_CONFIGS).join(", ")})`,
),
```

with:

```typescript
sdk: z.union(
  [
    z.enum([
      ...(Object.keys(SDK_CONFIGS) as (keyof typeof SDK_CONFIGS)[]),
      ...(Object.keys(SDK_ALIASES) as (keyof typeof SDK_ALIASES)[]),
    ]),
    SdkConfigSchema,
  ],
  `Expected a valid custom SDK configuration or one of the supported SDK ids (${Object.keys(SDK_CONFIGS).join(", ")}) or aliases (${Object.keys(SDK_ALIASES).join(", ")})`,
),
```

- [ ] **Step 4: Run the validator tests, expect all to pass**

```bash
bun test packages/jammin-sdk/config/config-validator.test.ts
```

Expected: PASS for all tests, including the four new ones from this task.

- [ ] **Step 5: Commit**

```bash
git add packages/jammin-sdk/config/config-validator.ts packages/jammin-sdk/config/config-validator.test.ts
git commit -m "Accept SDK aliases in build config validator"
```

---

## Task 5: Build command resolves alias before docker invocation

**Files:**
- Modify: `bin/cli/src/commands/build-command.ts`
- Modify: `bin/cli/src/commands/build-command.test.ts`

`callDockerBuild` currently does `SDK_CONFIGS[service.sdk]` directly when `service.sdk` is a string. With aliases, that lookup returns `undefined` for `as-lan` because the alias key isn't in `SDK_CONFIGS`. We route string SDK ids through `resolveSdkId` first.

- [ ] **Step 1: Add a failing test for the alias path through `callDockerBuild`**

Append to `bin/cli/src/commands/build-command.test.ts`, inside the `describe("buildService - Docker command generation", ...)` block (after the existing "should generate correct Docker command for predefined SDK (jade)" test):

```typescript
test("should generate correct Docker command for as-lan alias", async () => {
  const service: ServiceConfig = {
    name: "as-lan-service",
    path: "./services/example",
    sdk: "as-lan",
  };

  await callDockerBuild(service, "/test/project");

  expect(mockSpawn).toHaveBeenCalledTimes(1);
  const spawnCall = mockSpawn.mock.calls[0];
  if (!spawnCall) {
    throw new Error("spawnCall is undefined");
  }
  const dockerCommand = spawnCall[0][2] as string;

  expect(dockerCommand).toContain(SDK_CONFIGS["aslan-0.0.4"].image);
  expect(dockerCommand).toContain(SDK_CONFIGS["aslan-0.0.4"].build);
  expect(dockerCommand).toContain(`${resolve("/test/project", "./services/example")}:/app`);
});
```

- [ ] **Step 2: Run the new test, expect failure**

```bash
bun test bin/cli/src/commands/build-command.test.ts -t "as-lan alias"
```

Expected: FAIL — `SDK_CONFIGS["as-lan"]` is `undefined`, so the docker command won't include the expected image/build strings (likely throws on `sdk.build.split` because `sdk` is `undefined`).

- [ ] **Step 3: Use `resolveSdkId` in `callDockerBuild`**

Edit `bin/cli/src/commands/build-command.ts`. Update the import block (around lines 4-13) to add `resolveSdkId` and `type SdkConfig`:

```typescript
import type { ServiceConfig, SdkConfig } from "@fluffylabs/jammin-sdk";
import {
  copyJamToDist,
  generateTestConfigInProjectDir,
  getJamFiles,
  getServiceConfigs,
  loadServices,
  resolveSdkId,
  SDK_CONFIGS,
} from "@fluffylabs/jammin-sdk";
```

Replace line 28 in `callDockerBuild`:

```typescript
const sdk = typeof service.sdk === "string" ? SDK_CONFIGS[service.sdk] : service.sdk;
```

with:

```typescript
let sdk: SdkConfig;
if (typeof service.sdk === "string") {
  const canonicalId = resolveSdkId(service.sdk);
  if (!canonicalId) {
    throw new Error(`Unknown SDK id: '${service.sdk}'`);
  }
  sdk = SDK_CONFIGS[canonicalId];
} else {
  sdk = service.sdk;
}
```

- [ ] **Step 4: Run the build-command tests, expect all to pass**

```bash
bun test bin/cli/src/commands/build-command.test.ts
```

Expected: PASS for the new alias test plus all previously-passing tests.

- [ ] **Step 5: Commit**

```bash
git add bin/cli/src/commands/build-command.ts bin/cli/src/commands/build-command.test.ts
git commit -m "Resolve SDK aliases in build command"
```

---

## Task 6: Test command resolves alias before docker invocation

**Files:**
- Modify: `bin/cli/src/commands/test-command.ts`

Same change as Task 5, applied to `testService`. No new test file is added; Task 2 already covers `resolveSdkId` in isolation, and Task 5's test exercises the same helper through a docker invocation.

- [ ] **Step 1: Use `resolveSdkId` in `testService`**

Edit `bin/cli/src/commands/test-command.ts`. Update the import block (lines 4-5):

```typescript
import type { ServiceConfig, SdkConfig } from "@fluffylabs/jammin-sdk";
import { getServiceConfigs, resolveSdkId, SDK_CONFIGS } from "@fluffylabs/jammin-sdk";
```

Replace line 21 in `testService`:

```typescript
const sdk = typeof service.sdk === "string" ? SDK_CONFIGS[service.sdk] : service.sdk;
```

with:

```typescript
let sdk: SdkConfig;
if (typeof service.sdk === "string") {
  const canonicalId = resolveSdkId(service.sdk);
  if (!canonicalId) {
    throw new Error(`Unknown SDK id: '${service.sdk}'`);
  }
  sdk = SDK_CONFIGS[canonicalId];
} else {
  sdk = service.sdk;
}
```

- [ ] **Step 2: Run the full CLI test suite to confirm nothing regressed**

```bash
bun test bin/cli/
```

Expected: PASS for all tests.

- [ ] **Step 3: Commit**

```bash
git add bin/cli/src/commands/test-command.ts
git commit -m "Resolve SDK aliases in test command"
```

---

## Task 7: Register `aslan` template in create-command

**Files:**
- Modify: `bin/cli/src/commands/create-command.ts`

Pattern is identical to commit `b995067` (C3 SDK addition).

- [ ] **Step 1: Add `aslan` to the `Template` union and `TARGETS` map**

Edit `bin/cli/src/commands/create-command.ts`. Replace lines 5-14:

```typescript
type Template = "jam-sdk" | "jade" | "jambrains" | "ajanta" | "jamc3" | "undecided";

const TARGETS: Record<Template, string> = {
  "jam-sdk": "jammin-create/jammin-create-jam-sdk",
  jade: "jammin-create/jammin-create-jade",
  jambrains: "jammin-create/jammin-create-jambrains",
  ajanta: "jammin-create/jammin-create-ajanta",
  jamc3: "jammin-create/jammin-create-jamc3",
  undecided: "jammin-create/jammin-create-undecided",
};
```

with:

```typescript
type Template = "jam-sdk" | "jade" | "jambrains" | "ajanta" | "jamc3" | "aslan" | "undecided";

const TARGETS: Record<Template, string> = {
  "jam-sdk": "jammin-create/jammin-create-jam-sdk",
  jade: "jammin-create/jammin-create-jade",
  jambrains: "jammin-create/jammin-create-jambrains",
  ajanta: "jammin-create/jammin-create-ajanta",
  jamc3: "jammin-create/jammin-create-jamc3",
  aslan: "jammin-create/jammin-create-aslan",
  undecided: "jammin-create/jammin-create-undecided",
};
```

- [ ] **Step 2: Run the create-command tests, expect pass**

```bash
bun test bin/cli/src/commands/create-command.test.ts
```

Expected: PASS for all existing tests (the change is additive; existing tests don't enumerate templates).

- [ ] **Step 3: Smoke-test the help output to confirm `aslan` is offered**

```bash
bun run cli create --help
```

Expected: Output lists `aslan` as one of the `--template` choices.

- [ ] **Step 4: Commit**

```bash
git add bin/cli/src/commands/create-command.ts
git commit -m "Register aslan template in create-command"
```

---

## Task 8: Document the as-lan SDK in service-examples.md

**Files:**
- Modify: `docs/src/service-examples.md`

The existing page has sections for JAM SDK, JamBrains, and Jade. Add an "as-lan" section that mirrors that style.

- [ ] **Step 1: Add the as-lan section**

Append the following literal markdown to `docs/src/service-examples.md` after the existing Jade section. Mirror the existing section format (heading hierarchy `###` for SDK name, `####` for "Unit tests"). Use the Write/Edit tool — these are real fenced code blocks, not nested-string escapes.

Section content (semantic outline; render to markdown using the same shape as the existing JAM SDK / JamBrains / Jade sections in this same file):

1. `### as-lan` heading.
2. Short paragraph: "The as-lan docker image ships with Node.js, `wasm-pvm`, and the AssemblyScript toolchain pre-installed. Pull it:"
3. Console-fenced block: `$ docker pull ghcr.io/tomusdrw/jammin-as-lan:0.0.4`
4. Short paragraph: "Then `cd` into the example code directory and build:"
5. Console-fenced block, two lines:
   - `$ cd jammin-create-aslan/services/example`
   - `$ docker run --rm -v $(pwd):/app ghcr.io/tomusdrw/jammin-as-lan:0.0.4 npm run build`
6. Short paragraph: "The image's entrypoint symlinks the global toolchain into `/app/node_modules` if no `node_modules` already exists in the mounted directory."
7. `#### Unit tests` subheading.
8. Console-fenced block: `$ docker run --rm -v $(pwd):/app ghcr.io/tomusdrw/jammin-as-lan:0.0.4 npm test`
9. `#### SDK names accepted in jammin.build.yml` subheading.
10. Short paragraph: "Any of the following resolve to the same image and commands:"
11. Bulleted list (three items):
    - `` `aslan-0.0.4` `` (canonical key in `SDK_CONFIGS`)
    - `` `as-lan-0.0.4` `` (versioned alias matching the framework's spelling)
    - `` `as-lan` `` (bare alias — follows the current default version)

- [ ] **Step 2: Verify the markdown renders cleanly**

```bash
ls docs/src/service-examples.md && head -120 docs/src/service-examples.md
```

Expected: file ends with the new as-lan section, fenced blocks are well-formed.

- [ ] **Step 3: Commit**

```bash
git add docs/src/service-examples.md
git commit -m "Document as-lan SDK in service examples"
```

---

## Task 9: Final QA + smoke verification

**Files:** none modified

- [ ] **Step 1: Run the project's full QA gate**

```bash
bun run qa
```

Expected: PASS — Biome formatting/lint is clean, type checks pass.

- [ ] **Step 2: Run the full test suite**

```bash
bun test
```

Expected: PASS for all tests, including the new ones added in Tasks 1, 2, 3, 4, 5.

- [ ] **Step 3: Smoke test that an `as-lan` config validates end-to-end**

```bash
bun -e 'import("./packages/jammin-sdk/config/config-validator.js").then(m => { console.log(JSON.stringify(m.validateBuildConfig({ services: [{ path: "./svc", name: "svc", sdk: "as-lan" }] }), null, 2)); })'
```

Expected: prints a JSON object with `services[0].sdk === "as-lan"`, no thrown error.

- [ ] **Step 4: Confirm git log is clean**

```bash
git log --oneline origin/main..HEAD
```

Expected: 8 commits, one per implementation task plus the two existing spec commits already on the branch.

---

## Self-review checklist (run before opening PR)

- [ ] Spec section "Canonical SDK key" → covered by Task 1
- [ ] Spec section "Aliases" → covered by Task 2
- [ ] Spec section "Resolver helper" → covered by Task 2
- [ ] Spec section "Type widening" → covered by Task 3
- [ ] Spec section "Validation" → covered by Task 4
- [ ] Spec section "Build/test command consumption" → covered by Tasks 5 and 6
- [ ] Spec section "Create-command template" → covered by Task 7
- [ ] Spec section "Tests" → all listed test cases present in Tasks 1, 2, 4, 5
- [ ] Spec section "Docs" → covered by Task 8
- [ ] Validation matrix in spec → exercised by tests in Tasks 1, 2, 4
