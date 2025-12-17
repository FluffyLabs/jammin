import {
  block,
  bytes,
  codec,
  config,
  hash,
  state as jamState,
  json_parser,
  numbers,
  state_merkleization,
  state_vectors,
} from "@typeberry/lib";
import { ConfigError } from "../types/errors";
import { pathExists } from "./file-utils";

/// Generated service type

export interface ServiceBuildOutput {
  id: number;
  code: bytes.BytesBlob;
}

/// Genesis methods

const blake2b = await hash.Blake2b.createHasher();
const spec = config.tinyChainSpec;

export type Genesis = state_vectors.StateTransitionGenesis;

// Service without code hash
const DEFAULT_SERVICE: jamState.ServiceAccountInfo = {
  // accual codeHash of a given blob
  codeHash: hash.ZERO_HASH.asOpaque(),
  // Starting const value, add code.length later + if storage : 34 + storage key lenght + storage data lenght
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

/** Load and validates a genesis file */
export async function loadGenesisFile(filePath: string): Promise<Genesis> {
  if (!(await pathExists(filePath))) {
    throw new ConfigError(`Could not locate ${filePath} file`, filePath);
  }

  const file = Bun.file(filePath);

  if (filePath.endsWith(".bin")) {
    const fileContent = await file.bytes();
    const blob = bytes.BytesBlob.blobFrom(fileContent);
    return codec.Decoder.decodeObject(state_vectors.StateTransitionGenesis.Codec, blob, spec);
  }

  if (filePath.endsWith(".hex")) {
    const fileContent = await file.text();
    const blob = bytes.BytesBlob.parseBlob(fileContent);
    return codec.Decoder.decodeObject(state_vectors.StateTransitionGenesis.Codec, blob, spec);
  }

  if (filePath.endsWith(".json")) {
    const fileContent = await file.json();
    return json_parser.parseFromJson(fileContent, state_vectors.StateTransitionGenesis.fromJson);
  }

  throw new ConfigError("Input file format unsupported", filePath);
}

/** Creates genesis file in given directory */
export async function saveStateFile(genesis: Genesis, outputPath: string): Promise<void> {
  if (outputPath.endsWith(".bin")) {
    const blob = codec.Encoder.encodeObject(state_vectors.StateTransitionGenesis.Codec, genesis, spec);
    await Bun.write(outputPath, blob.raw);
    return;
  }

  if (outputPath.endsWith(".hex")) {
    const blob = codec.Encoder.encodeObject(state_vectors.StateTransitionGenesis.Codec, genesis, spec);
    await Bun.write(outputPath, blob.toString());
    return;
  }

  if (outputPath.endsWith(".json")) {
    const {
      parentHeaderHash: parent,
      priorStateRoot: parent_state_root,
      extrinsicHash: extrinsic_hash,
      timeSlotIndex: slot,
      epochMarker,
      ticketsMarker: tickets_mark,
      offendersMarker: offenders_mark,
      bandersnatchBlockAuthorIndex: author_index,
      entropySource: entropy_source,
      seal,
    } = genesis.header;

    const epoch_mark = epochMarker
      ? {
          entropy: epochMarker.entropy,
          tickets_entropy: epochMarker.ticketsEntropy,
          validators: epochMarker.validators,
        }
      : null;

    const genesisJson = {
      header: {
        parent,
        parent_state_root,
        extrinsic_hash,
        slot,
        epoch_mark,
        tickets_mark,
        offenders_mark,
        author_index,
        entropy_source,
        seal,
      },
      state: genesis.state,
    };
    await Bun.write(outputPath, JSON.stringify(genesisJson, null, 2));
    return;
  }

  throw new ConfigError("Output file format unsupported", outputPath);
}

/**
 * Update given StfState using provided configuration
 */
export function updateState(genesis: Genesis, config: { services?: ServiceBuildOutput[] } = {}): void {
  const state = state_merkleization.loadState(
    spec,
    blake2b,
    genesis.state.keyvals.map((x) => [x.key, x.value]),
  );

  if (config.services) {
    const timeSlot = block.tryAsTimeSlot(0);
    const update = {
      created: [],
      removed: [],
      updated: new Map(),
      preimages: new Map(),
      storage: new Map(),
    };

    for (const service of config.services) {
      const serviceId = block.tryAsServiceId(service.id);
      const codeHash = blake2b.hashBytes(service.code);
      const lookupHistory = new jamState.LookupHistoryItem(
        codeHash.asOpaque(),
        numbers.tryAsU32(service.code.length),
        jamState.tryAsLookupHistorySlots([timeSlot]),
      );
      update.preimages.set(serviceId, [
        jamState.UpdatePreimage.provide({
          preimage: jamState.PreimageItem.create({ hash: codeHash.asOpaque(), blob: service.code }),
          providedFor: serviceId,
          slot: timeSlot,
        }),
      ]);
      update.updated.set(
        serviceId,
        jamState.UpdateService.create({
          serviceInfo: jamState.ServiceAccountInfo.create({
            ...DEFAULT_SERVICE,
            codeHash: codeHash.asOpaque(),
            storageUtilisationBytes: numbers.sumU64(
              DEFAULT_SERVICE.storageUtilisationBytes,
              numbers.tryAsU64(service.code.length),
            ).value,
          }),
          lookupHistory,
        }),
      );
    }

    state.backend.applyUpdate(state_merkleization.serializeStateUpdate(spec, blake2b, update));
  }

  genesis.state.state_root = state.backend.getRootHash(blake2b);
  genesis.state.keyvals = Array.from(state.backend.entries()).map(([k, v]) => ({ key: k, value: v }));
}
