/**
 * SDK utility functions and helpers
 */

import { type ServiceGas, tryAsServiceGas } from "@typeberry/lib/block";
import { BytesBlob } from "@typeberry/lib/bytes";
import * as numbers from "@typeberry/lib/numbers";

/**
 * Validates and converts a number to U8.
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
 * Validates and converts a number to U16.
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
 * Validates and converts a number to U32.
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
 * Validates and converts a value (number or bigint) to U64.
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
 * Converts gas value (number or bigint) to ServiceGas type.
 * @throws Error if gas value is negative
 */
export function Gas(value: number | bigint, fieldName?: string): ServiceGas {
  const gasValue = typeof value === "number" ? BigInt(value) : value;
  if (gasValue < 0n) {
    const field = fieldName ? `${fieldName} ` : "";
    throw new Error(`${field}must be non-negative, got: ${gasValue}`);
  }
  return tryAsServiceGas(gasValue);
}

/**
 * Normalizes bytes input to BytesBlob type.
 */
export function Blob(input: Uint8Array | BytesBlob | undefined): BytesBlob {
  if (!input) {
    return BytesBlob.blobFrom(new Uint8Array());
  }
  return input instanceof Uint8Array ? BytesBlob.blobFrom(input) : input;
}
