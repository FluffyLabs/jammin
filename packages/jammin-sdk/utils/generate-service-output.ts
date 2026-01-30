import { resolve } from "node:path";
import {
  type preimage,
  type ServiceId as ServiceIdType,
  tryAsServiceGas,
  tryAsServiceId,
  tryAsTimeSlot,
} from "@typeberry/lib/block";
import { Bytes, BytesBlob } from "@typeberry/lib/bytes";
import { HashDictionary } from "@typeberry/lib/collections";
import { HASH_SIZE } from "@typeberry/lib/hash";
import { tryAsU32, tryAsU64 } from "@typeberry/lib/numbers";
import { type LookupHistorySlots, type ServiceAccountInfo, tryAsLookupHistorySlots } from "@typeberry/lib/state";
import { ServiceId, Slot } from "../types.js";

export interface ServiceBuildOutput {
  id: ServiceIdType;
  code: BytesBlob;
  storage?: Record<string, string>;
  info?: Partial<ServiceAccountInfo>;
  preimageBlobs?: HashDictionary<preimage.PreimageHash, BytesBlob>;
  preimageRequests?: Map<preimage.PreimageHash, LookupHistorySlots>;
}

export async function generateServiceOutput(
  jamFilePath: string,
  serviceId = 0,
  storage?: Record<string, string>,
  info?: {
    balance?: bigint;
    accumulateMinGas?: bigint;
    onTransferMinGas?: bigint;
    storageUtilisationBytes?: bigint;
    gratisStorage?: bigint;
    storageUtilisationCount?: number;
    created?: number;
    lastAccumulation?: number;
    parentService?: number;
  },
  preimageBlobs?: Record<string, string>,
  preimageRequests?: Record<string, number[]>,
): Promise<ServiceBuildOutput> {
  const absolutePath = resolve(jamFilePath);
  const fileBytes = await Bun.file(absolutePath).bytes();
  const code = BytesBlob.blobFrom(fileBytes);

  const serviceAccountInfo = Object.fromEntries(
    Object.entries({
      balance: info?.balance ? tryAsU64(info?.balance) : undefined,
      accumulateMinGas: info?.accumulateMinGas ? tryAsServiceGas(info?.accumulateMinGas) : undefined,
      onTransferMinGas: info?.onTransferMinGas ? tryAsServiceGas(info?.onTransferMinGas) : undefined,
      storageUtilisationBytes: info?.storageUtilisationBytes ? tryAsU64(info?.storageUtilisationBytes) : undefined,
      gratisStorage: info?.gratisStorage ? tryAsU64(info?.gratisStorage) : undefined,
      storageUtilisationCount: info?.storageUtilisationCount ? tryAsU32(info?.storageUtilisationCount) : undefined,
      created: info?.created ? tryAsTimeSlot(info?.created) : undefined,
      lastAccumulation: info?.lastAccumulation ? tryAsTimeSlot(info?.lastAccumulation) : undefined,
      parentService: info?.parentService ? tryAsServiceId(info?.parentService) : undefined,
    }).filter(([_, value]) => value !== undefined),
  );

  const preimageBlobsDict = HashDictionary.fromEntries(
    Object.entries(preimageBlobs ?? {}).map(([hash, blob]) => [
      Bytes.parseBytes(hash, HASH_SIZE).asOpaque(),
      BytesBlob.blobFromString(blob),
    ]),
  );

  const preimageRequestsMap = new Map<preimage.PreimageHash, LookupHistorySlots>(
    Object.entries(preimageRequests ?? {}).map(([hash, slots]) => [
      Bytes.parseBytes(hash, HASH_SIZE).asOpaque(),
      tryAsLookupHistorySlots(slots.map((slot) => Slot(slot))),
    ]),
  );

  return {
    id: ServiceId(serviceId),
    code,
    storage,
    info: serviceAccountInfo,
    preimageBlobs: preimageBlobsDict,
    preimageRequests: preimageRequestsMap,
  };
}
