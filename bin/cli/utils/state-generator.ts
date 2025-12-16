import { block, bytes, codec, hash, numbers, state, state_merkleization } from "@typeberry/lib";
import blake2b from "blake2b";
import z from "zod";
import { ConfigError } from "../types/errors";
import { pathExists } from "./file-utils";

/// zod schemas

const KeyValueSchema = z.object({
  key: z.string(),
  value: z.string(),
});

const StateSchema = z.object({
  state_root: z.string(),
  keyvals: z.array(KeyValueSchema),
});

export const StfStateSchema = z.object({
  header: z.unknown(),
  state: StateSchema,
});

type KeyValue = z.infer<typeof KeyValueSchema>;

export type StfState = z.infer<typeof StfStateSchema>;

/// Generated service type

export interface ServiceBuildOutput {
  id: number;
  code: bytes.BytesBlob;
}

/// Genesis methods

const libBlake2b = await hash.Blake2b.createHasher();

// Service without code hash
const DEFAULT_SERVICE: state.ServiceAccountInfo = {
  // To be set later to accual codeHash of a given blob
  codeHash: hash.ZERO_HASH.asOpaque(),
  // Starting const value, add code.length later
  storageUtilisationBytes: numbers.tryAsU64(81),
  // Preconfigured
  balance: numbers.tryAsU64(0xffffffffffffff27n),
  accumulateMinGas: block.tryAsServiceGas(0x0an),
  onTransferMinGas: block.tryAsServiceGas(0x0an),
  gratisStorage: numbers.tryAsU64(0xffffffffffffffffn),
  // Preimage + lookup
  // NOTE: Might change when one service would have multiple preimages at start
  storageUtilisationCount: numbers.tryAsU32(2),
  created: block.tryAsTimeSlot(0),
  lastAccumulation: block.tryAsTimeSlot(0),
  parentService: block.tryAsServiceId(0),
};

/**
 * Find the correct insertion index for a key
 */
function findInsertionIndex(keyvals: KeyValue[], key: string): number {
  let left = 0;
  let right = keyvals.length;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (keyvals[mid]) {
      if (keyvals[mid].key < key) {
        left = mid + 1;
      } else {
        right = mid;
      }
    } else {
      throw new Error("Index out of bounds");
    }
  }

  return left;
}

/** Load and validates a StfState file */
export async function loadStateFile(statePath: string): Promise<StfState> {
  if (!(await pathExists(statePath))) {
    throw new ConfigError(`Could not locate ${statePath} file`, statePath);
  }
  return StfStateSchema.parse(await Bun.file(statePath).json());
}

/** Creates StfState file in given directory */
export async function saveStateFile(state: StfState, outputPath: string): Promise<void> {
  await Bun.write(outputPath, JSON.stringify(state, null, 2));
}

/**
 * Update given StfState using provided configuration
 *
 * TODO: Recalculate state root hash
 */
export function updateState(genesis: StfState, config: { services?: ServiceBuildOutput[] } = {}): void {
  if (config.services) {
    const keyvals: KeyValue[] = [];
    for (const service of config.services) {
      keyvals.push(...createServiceEntries(service));
    }
    for (const { key, value } of keyvals) {
      const insertionIndex = findInsertionIndex(genesis.state.keyvals, key);
      genesis.state.keyvals.splice(insertionIndex, 0, { key, value });
    }
  }
}

/**
 * Creates list of key-values to be added to state
 * Generate: Preimage entry, Lookup entry and Service entry
 */
function createServiceEntries({ id, code }: ServiceBuildOutput): KeyValue[] {
  const keyvals: KeyValue[] = [];

  const hash = hashBytes(code);
  keyvals.push({ key: servicePreimageKey(id, hash), value: code.toString() });
  keyvals.push({ key: serviceLookupKey(id, hash, code.length), value: "0x0100000000" });
  const service = state.ServiceAccountInfo.create({
    ...DEFAULT_SERVICE,
    codeHash: hash.asOpaque(),
    storageUtilisationBytes: numbers.sumU64(DEFAULT_SERVICE.storageUtilisationBytes, numbers.tryAsU64(code.length))
      .value,
  });
  keyvals.push({
    key: serviceKey(id),
    value: codec.Encoder.encodeObject(state.codecWithVersion(state.ServiceAccountInfo.Codec), service).toString(),
  });

  return keyvals;
}

/// Helper functions

function hashBytes(b: bytes.BytesBlob): bytes.Bytes<32> {
  const hasher = blake2b(32);
  hasher.update(b.raw);
  return bytes.Bytes.fromBlob(hasher.digest(), 32);
}

function servicePreimageKey(serviceId: number, codeHash: bytes.Bytes<32>): string {
  return state_merkleization.stateKeys
    .servicePreimage(libBlake2b, block.tryAsServiceId(serviceId), codeHash.asOpaque())
    .toString()
    .substring(0, 64);
}

function serviceLookupKey(serviceId: number, codeHash: bytes.Bytes<32>, codeLength: number): string {
  return state_merkleization.stateKeys
    .serviceLookupHistory(
      libBlake2b,
      block.tryAsServiceId(serviceId),
      codeHash.asOpaque(),
      numbers.tryAsU32(codeLength),
    )
    .toString()
    .substring(0, 64);
}

function serviceKey(serviceId: number): string {
  return state_merkleization.stateKeys.serviceInfo(block.tryAsServiceId(serviceId)).toString().substring(0, 64);
}
