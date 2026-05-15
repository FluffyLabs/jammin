// Core configuration types matching YAML schema

import type { SDK_CONFIGS } from "../sdk-configs.js";

// jammin.build.yml types

export interface JamminBuildConfig {
  services: ServiceConfig[];
  deployment?: DeploymentConfig;
}

type WildcardKey = Extract<keyof typeof SDK_CONFIGS, `${string}@*`>;
type WildcardName = WildcardKey extends `${infer N}@*` ? N : never;
type PinnedKey = Exclude<keyof typeof SDK_CONFIGS, WildcardKey>;
type VersionedKey = `${WildcardName}@${string}`;

export interface ServiceConfig {
  /** Path to service directory */
  path: string;
  /** Service identifier */
  name: string;
  /** SDK id: `<name>@<version>`, a deprecated pinned key, or an inline config. */
  sdk: PinnedKey | VersionedKey | SdkConfig;
}

export interface SdkConfig {
  /** Docker image name */
  image: string;
  /** Build command */
  build: string;
  /** Test command */
  test: string;
}

/** Internal: `SdkConfig` plus an optional `deprecated` flag used by the resolver. */
export interface SdkConfigEntry extends SdkConfig {
  deprecated?: boolean;
}

export interface DeploymentConfig {
  /** Network name to spawn */
  spawn: string;
  /** Service deployment configurations */
  services?: Record<string, ServiceDeploymentConfig>;
}

export interface ServiceDeploymentConfig {
  /** Service ID (u32) */
  id?: number;
  /** Storage key-value pairs */
  storage?: Record<string, string>;
  /** Preimage blobs map: 32-byte preimage hash (0x hex) -> blob (0x hex) */
  preimageBlobs?: Record<string, string>;
  /** Preimage requests map: 32-byte preimage hash (0x hex) -> integer time slots */
  preimageRequests?: Record<string, number[]>;
  /** Optional service account info overrides */
  info?: ServiceAccountInfoConfig;
}

export interface ServiceAccountInfoConfig {
  balance?: bigint;
  accumulateMinGas?: bigint;
  onTransferMinGas?: bigint;
  storageUtilisationBytes?: bigint;
  gratisStorage?: bigint;
  storageUtilisationCount?: number;
  created?: number;
  lastAccumulation?: number;
  parentService?: number;
}

// jammin.network.yml types

export interface JamminNetworksConfig {
  networks: Record<string, NetworkConfig>;
}

export type NetworkConfig = NodeDefinition[] | ComposeNetworkConfig;

export interface NodeDefinition {
  /** Docker image with jam node */
  image: string;
  args?: string;
  /** Number of instances spawned */
  instances?: number;
}

export interface ComposeNetworkConfig {
  /** Path to docker-compose file */
  compose: string;
}
