import * as block from "@typeberry/lib/block";
import * as bytes from "@typeberry/lib/bytes";
import * as codec from "@typeberry/lib/codec";
import * as config from "@typeberry/lib/config";
import * as config_node from "@typeberry/lib/config-node";
import * as hash from "@typeberry/lib/hash";
import * as numbers from "@typeberry/lib/numbers";
import * as jamState from "@typeberry/lib/state";
import * as state_merkleization from "@typeberry/lib/state-merkleization";
import { asOpaqueType } from "@typeberry/lib/utils";

const blake2b = await hash.Blake2b.createHasher();
const spec = config.tinyChainSpec;

export type Genesis = config_node.JipChainSpec;

export interface ServiceBuildOutput {
  id: number;
  code: bytes.BytesBlob;
  storage?: Record<string, string>;
}

// https://graypaper.fluffylabs.dev/#/ab2cdbd/11e00111f001?v=0.7.2
const BASE_STORAGE_BYTES = 34n;

// Base ServiceInfo
const BASE_SERVICE: jamState.ServiceAccountInfo = {
  // actual codeHash of a given blob
  codeHash: hash.ZERO_HASH.asOpaque(),
  // Starting const value, add code.length later + if storage : 34 + storage key length + storage data length
  // https://graypaper.fluffylabs.dev/#/ab2cdbd/11ce0111ce01?v=0.7.2
  storageUtilisationBytes: numbers.tryAsU64(81),

  // Preconfigured
  balance: numbers.tryAsU64(2n ** 20n),
  accumulateMinGas: block.tryAsServiceGas(0x0an),
  onTransferMinGas: block.tryAsServiceGas(0x0an),
  gratisStorage: numbers.tryAsU64(0),
  // Preimage + lookup
  // NOTE: Might change when one service would have multiple preimages and storages at start
  storageUtilisationCount: numbers.tryAsU32(2),
  created: block.tryAsTimeSlot(0),
  lastAccumulation: block.tryAsTimeSlot(0),
  parentService: block.tryAsServiceId(0),
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
export function generateState(services: ServiceBuildOutput[]): Genesis {
  const memState = jamState.InMemoryState.empty(spec);

  const timeSlot = block.tryAsTimeSlot(0);
  const update: Partial<jamState.State & jamState.ServicesUpdate> = {
    created: [],
    removed: [],
    updated: new Map(),
    preimages: new Map(),
    storage: new Map(),
  };

  for (const service of services) {
    // prepare service
    const serviceId = block.tryAsServiceId(service.id);
    const codeHash = blake2b.hashBytes(service.code);
    const lookupHistory = new jamState.LookupHistoryItem(
      codeHash.asOpaque(),
      numbers.tryAsU32(service.code.length),
      jamState.tryAsLookupHistorySlots([timeSlot]),
    );
    update.preimages?.set(serviceId, [
      jamState.UpdatePreimage.provide({
        preimage: jamState.PreimageItem.create({ hash: codeHash.asOpaque(), blob: service.code }),
        providedFor: serviceId,
        slot: timeSlot,
      }),
    ]);

    // storage
    const storageUpdates: jamState.UpdateStorage[] = [];
    let storageBytes = 0n;
    const storageCount = service.storage ? Object.keys(service.storage).length : 0;

    if (service.storage) {
      for (const [keyStr, valueStr] of Object.entries(service.storage)) {
        const key: jamState.StorageKey = asOpaqueType(bytes.BytesBlob.blobFromString(keyStr));
        const value = bytes.BytesBlob.blobFromString(valueStr);
        const storageItem = jamState.StorageItem.create({ key, value });
        storageUpdates.push(jamState.UpdateStorage.set({ storage: storageItem }));
        storageBytes += BASE_STORAGE_BYTES + BigInt(key.length) + BigInt(value.length);
      }
    }

    if (storageUpdates.length > 0) {
      update.storage?.set(serviceId, storageUpdates);
    }

    const totalStorageBytes = numbers.sumU64(
      BASE_SERVICE.storageUtilisationBytes,
      numbers.tryAsU64(service.code.length),
      numbers.tryAsU64(storageBytes),
    ).value;

    const totalStorageCount = numbers.sumU32(
      BASE_SERVICE.storageUtilisationCount,
      numbers.tryAsU32(storageCount),
    ).value;

    // create service
    update.updated?.set(
      serviceId,
      jamState.UpdateService.create({
        serviceInfo: jamState.ServiceAccountInfo.create({
          ...BASE_SERVICE,
          codeHash: codeHash.asOpaque(),
          storageUtilisationBytes: totalStorageBytes,
          storageUtilisationCount: totalStorageCount,
        }),
        lookupHistory,
      }),
    );
  }

  memState.applyUpdate(update);

  const state = state_merkleization.StateEntries.serializeInMemory(spec, blake2b, memState);

  return config_node.JipChainSpec.create({
    id: "testnet",
    genesisHeader: codec.Encoder.encodeObject(block.Header.Codec, block.Header.empty(), spec),
    genesisState: new Map(Array.from(state.entries())),
  });
}
