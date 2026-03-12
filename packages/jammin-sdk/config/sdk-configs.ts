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
  "c3sdk-1.0.2": {
    image: "ghcr.io/dreverr/jamsdk:1.0.2",
    build: "main.c3 -o service.jam",
    test: "bun test",
  },
} as const satisfies Record<string, SdkConfig>;
