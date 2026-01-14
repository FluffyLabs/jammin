export {
  block,
  bytes,
  codec,
  config,
  config_node,
  hash,
  numbers,
  state,
  state_merkleization,
} from "@typeberry/lib";
export * from "./types.js";
export * from "./work-report.js";

export function getSDKInfo() {
  return {
    name: "@fluffylabs/jammin-sdk",
    version: "0.0.2",
    description: "JAM SDK for e2e integration tests and object encoding",
  };
}
