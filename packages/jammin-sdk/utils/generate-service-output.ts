import { resolve } from "node:path";
import { type ServiceId as ServiceIdType, tryAsServiceGas, tryAsServiceId, tryAsTimeSlot } from "@typeberry/lib/block";
import { BytesBlob } from "@typeberry/lib/bytes";
import { tryAsU32, tryAsU64 } from "@typeberry/lib/numbers";
import { ServiceId } from "../types.js";

export interface ServiceBuildOutput {
  id: ServiceIdType;
  code: BytesBlob;
  storage?: Record<string, string>;
  info?: Partial<import("@typeberry/lib/state").ServiceAccountInfo>;
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

  return {
    id: ServiceId(serviceId),
    code,
    storage,
    info: serviceAccountInfo,
  };
}
