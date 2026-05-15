import type { SdkConfig, SdkConfigEntry } from "./types/config.js";

const aslanCommon = { build: "npm run build", test: "npm test" } as const;
const jadeCommon = { build: "build", test: "test" } as const;

// Shared so `aslan@*` and `as-lan@*` cannot drift out of sync.
const aslanWildcard = { image: "ghcr.io/tomusdrw/jammin-as-lan:{version}", ...aslanCommon } as const;

export const SDK_CONFIGS = {
  // Wildcard entries: `<name>@*`. The {version} placeholder in `image` is
  // substituted with the version segment from the user's `<name>@<version>` id.
  "aslan@*": aslanWildcard,
  "as-lan@*": aslanWildcard,
  "jam-sdk@*": {
    image: "ghcr.io/fluffylabs/jammin-jam-sdk:{version}",
    build: "jam-pvm-build -m service",
    test: "cargo test",
  },
  "jade@*": { image: "ghcr.io/fluffylabs/jammin-jade:{version}", ...jadeCommon },
  "ajanta@*": {
    image: "ghcr.io/fluffylabs/jammin-ajanta:{version}",
    build: "ajanta build main.py -o service.jam",
    test: "true",
  },
  "jamc3@*": { image: "ghcr.io/dreverr/jamc3:{version}", build: "main.c3 -o service.jam", test: "--help" },

  // jambrains is pinned by sha256 digest, not by version tag. No wildcard
  // form. NOT deprecated.
  "jambrains-1cfc41c": {
    image:
      "ghcr.io/jambrains/service-sdk:latest@sha256:1cfc41c23f5c348aaee5f5c70aaa24f10c26baf903de4b4f6774e2032820ba87",
    build: "single-file main.c",
    test: "true",
  },

  // DEPRECATED: dash-style pinned keys are kept for back-compat in 0.3.x.
  // Remove this entire block in 0.4.0. Downstream configs should use the
  // `<name>@<version>` form (e.g. `aslan@0.0.6`).
  "jam-sdk-0.1.26": {
    image: "ghcr.io/fluffylabs/jammin-jam-sdk:0.1.26",
    build: "jam-pvm-build -m service",
    test: "cargo test",
    deprecated: true,
  },
  "jade-0.0.15-pre.1": { image: "ghcr.io/fluffylabs/jammin-jade:0.0.15-pre.1", ...jadeCommon, deprecated: true },
  "ajanta-0.1.0": {
    image: "ghcr.io/fluffylabs/jammin-ajanta:0.1.0",
    build: "ajanta build main.py -o service.jam",
    test: "true",
    deprecated: true,
  },
  "jamc3-2.0.2": {
    image: "ghcr.io/dreverr/jamc3:2.0.2",
    build: "main.c3 -o service.jam",
    test: "--help",
    deprecated: true,
  },
  "aslan-0.0.6": { image: "ghcr.io/tomusdrw/jammin-as-lan:0.0.6", ...aslanCommon, deprecated: true },
} as const satisfies Record<string, SdkConfigEntry>;

// Module-load invariant: every wildcard entry must contain a {version} placeholder.
for (const [key, entry] of Object.entries(SDK_CONFIGS)) {
  if (key.endsWith("@*") && !entry.image.includes("{version}")) {
    throw new Error(`SDK_CONFIGS entry '${key}' must include '{version}' in image`);
  }
}

const VERSION_RE = /^[A-Za-z0-9._-]+$/;

/** Predicate used by the validator to check if an SDK id is known. */
export function isKnownSdkId(id: string): boolean {
  if (Object.hasOwn(SDK_CONFIGS, id)) {
    return true;
  }
  const at = id.indexOf("@");
  if (at < 0) {
    return false;
  }
  const name = id.slice(0, at);
  const version = id.slice(at + 1);
  if (!VERSION_RE.test(version)) {
    return false;
  }
  return Object.hasOwn(SDK_CONFIGS, `${name}@*`);
}

const warned = new Set<string>();

/** Test-only: reset the dedup set used by the deprecation warning. */
export function __resetDeprecationWarnings(): void {
  warned.clear();
}

function stripDeprecatedFlag(entry: SdkConfigEntry): SdkConfig {
  const { deprecated: _deprecated, ...config } = entry;
  return config;
}

function suggestReplacement(deprecatedKey: string): string | undefined {
  const match = deprecatedKey.match(/^(.+?)-(\d.*)$/);
  if (!match) {
    return undefined;
  }
  const [, name, version] = match;
  if (Object.hasOwn(SDK_CONFIGS, `${name}@*`)) {
    return `${name}@${version}`;
  }
  return undefined;
}

function warnOnceForDeprecated(id: string): void {
  if (warned.has(id)) {
    return;
  }
  warned.add(id);
  const suggestion = suggestReplacement(id);
  const tail = suggestion ? ` Use '${suggestion}' instead.` : "";
  console.warn(`[jammin] SDK id '${id}' is deprecated and will be removed in 0.4.0.${tail}`);
}

/**
 * Resolve a service's `sdk` field to a concrete SdkConfig. Accepts:
 * - a canonical wildcard-versioned id (`<name>@<version>`),
 * - a deprecated pinned id (e.g. `aslan-0.0.6`),
 * - or an inline SdkConfig object.
 * Throws for unknown string ids.
 */
export function resolveSdk(sdk: string | SdkConfig): SdkConfig {
  if (typeof sdk !== "string") {
    return sdk;
  }

  if (Object.hasOwn(SDK_CONFIGS, sdk)) {
    const entry = SDK_CONFIGS[sdk as keyof typeof SDK_CONFIGS] as SdkConfigEntry;
    if (entry.deprecated) {
      warnOnceForDeprecated(sdk);
    }
    return stripDeprecatedFlag(entry);
  }

  const at = sdk.indexOf("@");
  if (at >= 0) {
    const name = sdk.slice(0, at);
    const version = sdk.slice(at + 1);
    if (VERSION_RE.test(version)) {
      const wildcardKey = `${name}@*`;
      if (Object.hasOwn(SDK_CONFIGS, wildcardKey)) {
        const entry = SDK_CONFIGS[wildcardKey as keyof typeof SDK_CONFIGS] as SdkConfigEntry;
        const config = stripDeprecatedFlag(entry);
        return { ...config, image: config.image.replaceAll("{version}", version) };
      }
    }
  }

  throw new Error(`Unknown SDK id: '${sdk}'`);
}
