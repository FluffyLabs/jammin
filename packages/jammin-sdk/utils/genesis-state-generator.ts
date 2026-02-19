import { Header } from "@typeberry/lib/block";
import { BytesBlob } from "@typeberry/lib/bytes";
import { Encoder } from "@typeberry/lib/codec";
import { tinyChainSpec } from "@typeberry/lib/config";
import { JipChainSpec } from "@typeberry/lib/config-node";
import { Blake2b, ZERO_HASH } from "@typeberry/lib/hash";
import { sumU32, sumU64 } from "@typeberry/lib/numbers";
import {
  InMemoryState,
  LookupHistoryItem,
  PreimageItem,
  ServiceAccountInfo,
  type ServicesUpdate,
  type State,
  StorageItem,
  type StorageKey,
  tryAsLookupHistorySlots,
  UpdatePreimage,
  UpdateService,
  UpdateStorage,
} from "@typeberry/lib/state";
import { StateEntries } from "@typeberry/lib/state-merkleization";
import { asOpaqueType } from "@typeberry/lib/utils";
import { Gas, ServiceId, Slot, U32, U64 } from "../types.js";
import type { ServiceBuildOutput } from "./generate-service-output.js";

const blake2b = await Blake2b.createHasher();
const spec = tinyChainSpec;

export type Genesis = JipChainSpec;

// https://graypaper.fluffylabs.dev/#/ab2cdbd/11e00111f001?v=0.7.2
const BASE_STORAGE_BYTES = 34n;

/** https://graypaper.fluffylabs.dev/#/ab2cdbd/11cc0111ce01?v=0.7.2 */
const LOOKUP_HISTORY_ENTRY_BYTES = 81n;

// Base ServiceInfo
const BASE_SERVICE: ServiceAccountInfo = {
  // actual codeHash of a given blob
  codeHash: ZERO_HASH.asOpaque(),
  // Starting const value, add code.length later + if storage : 34 + storage key length + storage data length
  // https://graypaper.fluffylabs.dev/#/ab2cdbd/11ce0111ce01?v=0.7.2
  storageUtilisationBytes: U64(81),

  // Default
  balance: U64(2n ** 20n),

  // Preconfigured
  accumulateMinGas: Gas(0x0an),
  onTransferMinGas: Gas(0x0an),
  gratisStorage: U64(0),
  // Preimage + lookup
  // NOTE: Might change when one service would have multiple preimages and storages at start
  storageUtilisationCount: U32(2),
  created: Slot(0),
  lastAccumulation: Slot(0),
  parentService: ServiceId(0),
};

/** Creates genesis file on given path: JIP-4 Chainspec */
export async function saveStateFile(genesis: Genesis, outputFile: string): Promise<void> {
  await Bun.write(outputFile, JSON.stringify(toJip4Schema(genesis), null, 2));
}

export function toJip4Schema(genesis: Genesis) {
  return {
    id: genesis.id,
    bootnodes: genesis.bootnodes,
    genesis_header: genesis.genesisHeader.toString().substring(2),
    genesis_state: Array.from(genesis.genesisState.entries()).map(([key, value]) => [
      key.toString().substring(2),
      value.toString().substring(2),
    ]),
    // TODO: [MaSo] Update typeberry jip4Chainspec - add protocol_parameters
  };
}

/** Creates a new state with provided services */
export function generateState(services: ServiceBuildOutput[]): InMemoryState {
  const memState = InMemoryState.empty(spec);

  const timeSlot = Slot(0);
  const update: Partial<State & ServicesUpdate> = {
    created: [],
    removed: [],
    updated: new Map(),
    preimages: new Map(),
    storage: new Map(),
  };

  for (const service of services) {
    // prepare service
    const serviceId = ServiceId(service.id);
    const codeHash = blake2b.hashBytes(service.code);
    const lookupHistory = new LookupHistoryItem(
      codeHash.asOpaque(),
      U32(service.code.length),
      tryAsLookupHistorySlots([timeSlot]),
    );

    update.preimages?.set(serviceId, [
      UpdatePreimage.provide({
        preimage: PreimageItem.create({ hash: codeHash.asOpaque(), blob: service.code }),
        providedFor: serviceId,
        slot: timeSlot,
      }),
    ]);

    // storage
    const storageUpdates: UpdateStorage[] = [];
    let storageBytes = 0n;
    const storageCount = service.storage ? Object.keys(service.storage).length : 0;

    if (service.storage) {
      for (const [keyStr, valueStr] of Object.entries(service.storage)) {
        const key: StorageKey = asOpaqueType(BytesBlob.blobFromString(keyStr));
        const value = BytesBlob.blobFromString(valueStr);
        const storageItem = StorageItem.create({ key, value });
        storageUpdates.push(UpdateStorage.set({ storage: storageItem }));
        storageBytes += BASE_STORAGE_BYTES + BigInt(key.length) + BigInt(value.length);
      }
    }

    if (storageUpdates.length > 0) {
      update.storage?.set(serviceId, storageUpdates);
    }

    let calculatedStorageBytes = sumU64(
      BASE_SERVICE.storageUtilisationBytes,
      U64(service.code.length),
      U64(storageBytes),
    ).value;

    let calculatedStorageCount = sumU32(BASE_SERVICE.storageUtilisationCount, U32(storageCount)).value;

    // add preimage blobs and preimage requests
    if (service.preimageRequests) {
      const preimageUpdates = update.preimages?.get(serviceId) ?? [];

      for (const [hash, slots] of service.preimageRequests) {
        const preimageBlob = service.preimageBlobs?.get(hash);

        if (!preimageBlob) {
          throw new Error(`Preimage blob not found for hash ${hash}`);
        }

        // request preimage
        const lookupHistory = new LookupHistoryItem(hash, U32(preimageBlob.length), tryAsLookupHistorySlots([]));
        preimageUpdates.push(UpdatePreimage.updateOrAdd({ lookupHistory }));

        // update storage utilisation
        calculatedStorageBytes = sumU64(
          calculatedStorageBytes,
          U64(LOOKUP_HISTORY_ENTRY_BYTES + BigInt(preimageBlob.length)),
        ).value;
        calculatedStorageCount = sumU32(calculatedStorageCount, U32(2)).value;

        // provide
        if (slots.length >= 1) {
          if (preimageBlob) {
            preimageUpdates.push(
              UpdatePreimage.provide({
                preimage: PreimageItem.create({ hash, blob: preimageBlob }),
                providedFor: serviceId,
                slot: slots[0],
              }),
            );
          }
        }

        // update lookup history
        if (slots.length > 1) {
          const lookupHistory = new LookupHistoryItem(hash, U32(preimageBlob.length), slots);
          preimageUpdates.push(UpdatePreimage.updateOrAdd({ lookupHistory }));
        }
      }

      if (preimageUpdates.length > 0) {
        update.preimages?.set(serviceId, preimageUpdates);
      }
    }

    // create service
    update.updated?.set(
      serviceId,
      UpdateService.create({
        serviceInfo: ServiceAccountInfo.create({
          ...BASE_SERVICE,
          codeHash: codeHash.asOpaque(),
          storageUtilisationBytes: calculatedStorageBytes,
          storageUtilisationCount: calculatedStorageCount,
          ...service.info,
        }),
        lookupHistory,
      }),
    );
  }

  memState.applyUpdate(update);

  return memState;
}

/** Creates a new genesis state with provided services */
export function generateGenesis(services: ServiceBuildOutput[]): Genesis {
  const state = StateEntries.serializeInMemory(spec, blake2b, generateState(services));

  return JipChainSpec.create({
    id: "testnet",
    genesisHeader: Encoder.encodeObject(Header.Codec, Header.empty(), spec),
    genesisState: new Map(Array.from(state.entries())),
  });
}
