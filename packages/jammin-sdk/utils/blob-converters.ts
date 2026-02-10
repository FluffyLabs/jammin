import { BytesBlob } from "@typeberry/lib/bytes";

/**
 * Convert a UTF-8 string to a BytesBlob
 *
 * @param str - UTF-8 string to convert
 * @returns BytesBlob representation of the string
 *
 * @example
 * ```typescript
 * import { stringToBlob } from "@fluffylabs/jammin-sdk";
 * const blob = stringToBlob("hello");
 * ```
 */
export function stringToBlob(str: string): BytesBlob {
  return BytesBlob.blobFromString(str);
}

/**
 * Convert an array of numbers to a BytesBlob
 *
 * @param numbers - Array of numbers (0-255) to convert
 * @returns BytesBlob representation of the numbers
 *
 * @example
 * ```typescript
 * import { numbersToBlob } from "@fluffylabs/jammin-sdk";
 * const blob = numbersToBlob([1, 2, 3]);
 * ```
 */
export function numbersToBlob(numbers: number[]): BytesBlob {
  return BytesBlob.blobFromNumbers(numbers);
}

/**
 * Parse a hex string (with or without 0x prefix) to a BytesBlob
 *
 * @param hex - Hex string to parse (can include 0x prefix)
 * @returns BytesBlob representation of the hex data
 *
 * @example
 * ```typescript
 * import { hexToBlob } from "@fluffylabs/jammin-sdk";
 * const blob = hexToBlob("0xaabbccdd");
 * const blob2 = hexToBlob("aabbccdd");  // Also works without 0x prefix
 * ```
 */
export function hexToBlob(hex: string): BytesBlob {
  // If hex has 0x prefix, use parseBlob (with prefix)
  if (hex.startsWith("0x")) {
    return BytesBlob.parseBlob(hex);
  }
  // Otherwise, use parseBlobNoPrefix (without prefix)
  return BytesBlob.parseBlobNoPrefix(hex);
}
