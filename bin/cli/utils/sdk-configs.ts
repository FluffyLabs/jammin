import type { SdkConfig } from "../types/config";

export const SDK_CONFIGS: Record<string, SdkConfig> = {
  "jam-sdk-0.1.26": {
    image: "jam-sdk",
    build: "jam-pvm-build -m service",
    test: "cargo test",
  },
  jambrains: {
    image: "ghcr.io/jambrains/service-sdk:latest",
    build: "single-file main.c",
    test: "single-file main.c --test",
  },
  jade: {
    image: "jade",
    build: "build",
    test: "test",
  },
};
