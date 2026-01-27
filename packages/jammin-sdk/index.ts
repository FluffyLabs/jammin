export * as block from "@typeberry/lib/block";
export * as bytes from "@typeberry/lib/bytes";
export * as codec from "@typeberry/lib/codec";
export * as config from "@typeberry/lib/config";
export * as config_node from "@typeberry/lib/config-node";
export * as hash from "@typeberry/lib/hash";
export * as numbers from "@typeberry/lib/numbers";
export * as state from "@typeberry/lib/state";
export * as state_merkleization from "@typeberry/lib/state-merkleization";
export * from "./genesis-state-generator.js";
export * from "./simulator.js";
export * from "./types.js";
export * from "./util/generate-service-output.js";
export * from "./work-report.js";

export function getSDKInfo() {
  return {
    name: "@fluffylabs/jammin-sdk",
    version: "0.0.2",
    description: "JAM SDK for e2e integration tests and object encoding",
  };
}
