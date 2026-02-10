import { BytesBlob } from "@typeberry/lib/bytes";

export * as block from "@typeberry/lib/block";
export * as codec from "@typeberry/lib/codec";
export * as config from "@typeberry/lib/config";
export * as config_node from "@typeberry/lib/config-node";
export * as hash from "@typeberry/lib/hash";
export * as numbers from "@typeberry/lib/numbers";
export * as state_merkleization from "@typeberry/lib/state-merkleization";
export * from "./config/index.js";
export * from "./genesis-state-generator.js";
export * from "./testing-helpers.js";
export * from "./types.js";
export * from "./utils/index.js";

export function getSDKInfo() {
  return {
    name: "@fluffylabs/jammin-sdk",
    version: "0.0.2",
    description: "JAM SDK for e2e integration tests and object encoding",
  };
}

/**
 * Create `BytesBlob` by converting given UTF-u encoded string into bytes.
 *
 * @example
 * ```typescript
 * const blob = StringToBytes("Hello, World!");
 * ```
 */
export function StringToBytes(data: string): BytesBlob {
  return BytesBlob.blobFromString(data);
}

/**
 * Create `BytesBlob` from an array of bytes.
 *
 * @example
 * ```typescript
 * const blob = NumbersToBytes([1, 2, 3]);
 * ```
 */
export function NumbersToBytes(data: number[]): BytesBlob {
  return BytesBlob.blobFromNumbers(data);
}

/**
 * Create `BytesBlob` from hex-encoded bytes string.
 *
 * @example
 * ```typescript
 * const blob = HexToBytes("deadface");
 * // or
 * const blob = HexToBytes("0x1337beef");
 * ```
 */
export function HexToBytes(hex: string): BytesBlob {
  if (!hex.startsWith("0x")) {
    return BytesBlob.parseBlobNoPrefix(hex);
  }
  return BytesBlob.parseBlob(hex);
}
