# Add as-lan as a built-in SDK

## Goal

Make as-lan a first-class supported framework so a service author writes
`sdk: as-lan` (or `sdk: as-lan-0.0.4`, or `sdk: aslan-0.0.4`) in
`jammin.build.yml` and jammin resolves the docker image plus build/test
commands automatically — no inline image/build/test fields required.

`jammin create my-app --template aslan` scaffolds from
`jammin-create/jammin-create-aslan`.

## Non-goals

- Generalised alias resolution (regex/prefix transforms across the SDK
  family). The alias map is explicit.
- Versioned aliases for as-lan releases that haven't been pinned yet
  (e.g. `as-lan-0.0.3` — only versions present in `SDK_CONFIGS` get an
  alias entry).
- Migrating the image to `ghcr.io/fluffylabs/jammin-as-lan` (the
  namespace used by other built-in SDKs). The README documents that
  target, but only `ghcr.io/tomusdrw/jammin-as-lan` is published today.
  This spec pins to `tomusdrw` to match what works; a future change can
  flip the namespace once the image is mirrored.

## Image behaviour

`ghcr.io/tomusdrw/jammin-as-lan:0.0.4` is published and ships with
Node.js, `wasm-pvm`, and the as-lan/ecalli/AssemblyScript packages
pre-installed globally. Its entrypoint symlinks the global install into
`/app/node_modules` when none exists in the mounted volume, so
`npm run build` and `npm test` work against the user's source without a
per-build `npm install`.

## Design

### Canonical SDK key

`aslan-0.0.4`. Keeps the existing kebab-case-plus-version convention
shared with `jamc3-1.1.2`, `ajanta-0.1.0`, `jam-sdk-0.1.26`. Underlying
image: `ghcr.io/tomusdrw/jammin-as-lan:0.0.4`. Build command:
`npm run build`. Test command: `npm test`.

### Aliases

A new exported map next to `SDK_CONFIGS`:

```ts
export const SDK_ALIASES = {
  "as-lan": "aslan-0.0.4",
  "as-lan-0.0.4": "aslan-0.0.4",
} as const satisfies Record<string, keyof typeof SDK_CONFIGS>;
```

- `as-lan` (bare) — points to the current default as-lan version.
  Convenient shorthand; will silently follow version bumps when the
  default changes.
- `as-lan-0.0.4` — versioned re-spelling (matches the framework's
  canonical name with the dash). Pinned, will not move.

When a future `aslan-0.0.5` is added, `SDK_ALIASES` gains a
`"as-lan-0.0.5": "aslan-0.0.5"` entry and the bare `"as-lan"` alias
target is rebumped to `aslan-0.0.5`.

### Resolver helper

```ts
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

Single source of truth for "string SDK identifier → canonical
`SDK_CONFIGS` key". Lives in `packages/jammin-sdk/config/sdk-configs.ts`
alongside the data it operates on.

### Type widening

`ServiceConfig.sdk` becomes:

```ts
sdk: keyof typeof SDK_CONFIGS | keyof typeof SDK_ALIASES | SdkConfig;
```

So the YAML config type is honest about which strings are accepted.

### Validation

`config-validator.ts` Zod schema for `sdk` field accepts canonical keys
**and** alias keys. Resolution happens at consumption time, not
validation time — the parsed config keeps whatever string the user
wrote (useful for error messages and round-tripping). Validator error
message lists both sets:

> Expected a valid custom SDK configuration or one of the supported SDK
> ids (jam-sdk-0.1.26, jambrains-1cfc41c, jade-0.0.15-pre.1,
> ajanta-0.1.0, jamc3-1.1.2, aslan-0.0.4) or aliases (as-lan,
> as-lan-0.0.4)

### Build/test command consumption

`bin/cli/src/commands/build-command.ts` line 28 currently:

```ts
const sdk = typeof service.sdk === "string" ? SDK_CONFIGS[service.sdk] : service.sdk;
```

Becomes:

```ts
let sdk: SdkConfig;
if (typeof service.sdk === "string") {
  const canonicalId = resolveSdkId(service.sdk);
  if (!canonicalId) {
    throw new Error(`Unknown SDK id: ${service.sdk}`);
  }
  sdk = SDK_CONFIGS[canonicalId];
} else {
  sdk = service.sdk;
}
```

Same change in `test-command.ts` line 21. The thrown error is a
defensive belt — the validator should already have rejected unknown
ids, but a stale config could in principle bypass it.

### Create-command template

`bin/cli/src/commands/create-command.ts`:

- Add `aslan` to the `Template` type union
- Add `aslan: "jammin-create/jammin-create-aslan"` to `TARGETS`

Pattern is identical to commit `b995067` (C3 SDK).

## Files touched

- `packages/jammin-sdk/config/sdk-configs.ts` — new entry, alias map, resolver helper
- `packages/jammin-sdk/config/types/config.ts` — widen `ServiceConfig.sdk`
- `packages/jammin-sdk/config/config-validator.ts` — accept alias keys, update error message
- `bin/cli/src/commands/build-command.ts` — use `resolveSdkId` before `SDK_CONFIGS` lookup
- `bin/cli/src/commands/test-command.ts` — same as above
- `bin/cli/src/commands/create-command.ts` — register `aslan` template

## Tests

Additions only, no new files except where noted.

`packages/jammin-sdk/config/config-validator.test.ts`:
- Accepts canonical `aslan-0.0.4`
- Accepts alias `as-lan`
- Accepts alias `as-lan-0.0.4`
- Rejects unknown alias `as-lan-0.0.3`
- Rejects misspelt canonical `aslan` (no version)

`packages/jammin-sdk/config/sdk-configs.test.ts` (new file, small):
- `resolveSdkId("aslan-0.0.4")` returns `"aslan-0.0.4"`
- `resolveSdkId("as-lan")` returns `"aslan-0.0.4"`
- `resolveSdkId("as-lan-0.0.4")` returns `"aslan-0.0.4"`
- `resolveSdkId("nonsense")` returns `undefined`

`bin/cli/src/commands/build-command.test.ts`:
- Existing `jambrains-1cfc41c` / `jade-0.0.15-pre.1` cases stay
- Add a case asserting that `service.sdk === "as-lan"` produces a
  docker invocation containing the `aslan-0.0.4` image and build command

## Docs

`docs/src/service-examples.md`:
- New "as-lan" section under "Using Docker images" mirroring the JAM
  SDK / JamBrains / Jade entries (image, build invocation, brief test
  invocation)
- Brief mention of accepted SDK names: canonical, dashed-versioned, and
  bare alias

`docs/src/SUMMARY.md` — no change (editing existing page only).

## Validation matrix

| Input                  | Validator | Resolves to    |
|------------------------|-----------|----------------|
| `aslan-0.0.4`          | accept    | `aslan-0.0.4`  |
| `as-lan`               | accept    | `aslan-0.0.4`  |
| `as-lan-0.0.4`         | accept    | `aslan-0.0.4`  |
| `as-lan-0.0.3`         | reject    | n/a            |
| `aslan` (no version)   | reject    | n/a            |
| custom `SdkConfig` obj | accept    | the inline obj |
