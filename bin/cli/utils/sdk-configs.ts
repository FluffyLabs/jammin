import type { SdkConfig } from "../types/config";

export const SDK_CONFIGS = {
  "jam-sdk-0.1.26": {
    image: "jam-sdk", // todo [seko] replace with pushed image name
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
    image: "jade", // todo [seko] replace with pushed image name
    build: "build",
    test: "test",
  },
  "ajanta-0.1.0": {
    image: "ajanta", // TODO replace with pushed image name
    build: "ajanta build main.py -o service.jam",
    test: "true",
  },
} as const satisfies Record<string, SdkConfig>;
