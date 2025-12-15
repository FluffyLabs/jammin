import type { SdkConfig } from "../types/config";

export const SDK_CONFIGS = {
  "jam-sdk-0.1.26": {
    image: "jam-sdk", // todo [seko] replace with pushed image name
    build: "jam-pvm-build -m service",
    test: "cargo test",
  },
  jambrains: {
    image: "ghcr.io/jambrains/service-sdk:latest",
    build: "single-file main.c",
    test: "true",
  },
  "jade-0.0.15-pre.1": {
    image: "jade", // todo [seko] replace with pushed image name
    build: "build",
    test: "test",
  },
} as const satisfies Record<string, SdkConfig>;
