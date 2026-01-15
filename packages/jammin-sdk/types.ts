/**
 * SDK utility functions and helpers
 */

import { block, bytes, type hash as h, numbers } from "@typeberry/lib";

/**
 * Validates and converts a number to U8 with clear error messages.
 * @throws Error if value is out of valid U8 range
 */
export function U8(value: number, fieldName?: string): numbers.U8 {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    const field = fieldName ? `${fieldName} ` : "";
    throw new Error(`${field}must be a valid U8 (0 to 255), got: ${value}`);
  }
  return numbers.tryAsU8(value);
}

/**
 * Validates and converts a number to U16 with clear error messages.
 * @throws Error if value is out of valid U16 range
 */
export function U16(value: number, fieldName?: string): numbers.U16 {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    const field = fieldName ? `${fieldName} ` : "";
    throw new Error(`${field}must be a valid U16 (0 to 65535), got: ${value}`);
  }
  return numbers.tryAsU16(value);
}

/**
 * Validates and converts a number to U32 with clear error messages.
 * @throws Error if value is out of valid U32 range
 */
export function U32(value: number, fieldName?: string): numbers.U32 {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    const field = fieldName ? `${fieldName} ` : "";
    throw new Error(`${field}must be a valid U32 (0 to 4294967295), got: ${value}`);
  }
  return numbers.tryAsU32(value);
}

/**
 * Validates and converts a number to U64 with clear error messages.
 * @throws Error if value is out of valid U64 range
 */
export function U64(value: number | bigint, fieldName?: string): numbers.U64 {
  const bigintValue = typeof value === "number" ? BigInt(value) : value;
  if (bigintValue < 0n) {
    const field = fieldName ? `${fieldName} ` : "";
    throw new Error(`${field}must be non-negative, got: ${bigintValue}`);
  }
  return numbers.tryAsU64(bigintValue);
}

/**
 * Converts gas value (number or bigint) to ServiceGas type with validation.
 * @throws Error if gas value is negative
 */
export function Gas(value: number | bigint, fieldName?: string): block.ServiceGas {
  const gasValue = typeof value === "number" ? BigInt(value) : value;
  if (gasValue < 0n) {
    const field = fieldName ? `${fieldName} ` : "";
    throw new Error(`${field}must be non-negative, got: ${gasValue}`);
  }
  return block.tryAsServiceGas(gasValue);
}

/**
 * Normalizes bytes input to BytesBlob type.
 */
export function BytesBlob(input: Uint8Array | bytes.BytesBlob | undefined): bytes.BytesBlob {
  if (!input) {
    return bytes.BytesBlob.blobFrom(new Uint8Array());
  }
  return input instanceof Uint8Array ? bytes.BytesBlob.blobFrom(input) : input;
}

/**
 * Normalizes hash input.
 * Preserves the branded type using generics.
 */
export function Hash<T extends h.OpaqueHash>(hash: T | undefined): T | undefined {
  if (!hash) {
    return undefined;
  }
  return hash as T;
}
