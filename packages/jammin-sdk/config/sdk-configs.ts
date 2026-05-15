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
  "jamc3-2.0.2": {
    image: "ghcr.io/dreverr/jamc3:2.0.2",
    build: "main.c3 -o service.jam",
    test: "echo 'No test support for JAMC3'",
  },
  "aslan-0.0.6": {
    image: "ghcr.io/tomusdrw/jammin-as-lan:0.0.6",
    build: "npm run build",
    test: "npm test",
  },
} as const satisfies Record<string, SdkConfig>;

export const SDK_ALIASES = {
  "as-lan": "aslan-0.0.6",
  "as-lan-0.0.6": "aslan-0.0.6",
} as const satisfies Record<string, keyof typeof SDK_CONFIGS>;

/**
 * Resolve a string SDK identifier (canonical key or alias) to a canonical
 * SDK_CONFIGS key. Returns undefined for unknown identifiers.
 */
export function resolveSdkId(id: string): keyof typeof SDK_CONFIGS | undefined {
  if (Object.hasOwn(SDK_CONFIGS, id)) {
    return id as keyof typeof SDK_CONFIGS;
  }
  if (Object.hasOwn(SDK_ALIASES, id)) {
    return SDK_ALIASES[id as keyof typeof SDK_ALIASES];
  }
  return undefined;
}

/**
 * Resolve a service's `sdk` field to a concrete SdkConfig. Accepts canonical
 * keys, alias keys, or an inline SdkConfig object. Throws for unknown string
 * identifiers.
 */
export function resolveSdk(sdk: string | SdkConfig): SdkConfig {
  if (typeof sdk !== "string") {
    return sdk;
  }
  const canonicalId = resolveSdkId(sdk);
  if (!canonicalId) {
    throw new Error(`Unknown SDK id: '${sdk}'`);
  }
  return SDK_CONFIGS[canonicalId];
}
