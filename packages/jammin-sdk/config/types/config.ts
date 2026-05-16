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
  /**
   * Docker image name. The referenced image must publish a manifest matching
   * `platform` (defaults to `linux/amd64`). See `docs/src/requirements.md`.
   */
  image: string;
  /** Build command */
  build: string;
  /** Test command */
  test: string;
  /**
   * Docker platform passed via `--platform=<value>`. Defaults to `linux/amd64`
   * because most JAM SDK images today only ship an amd64 manifest. Override
   * (e.g. `"linux/arm64"`) only when the image publishes a matching manifest.
   */
  platform?: string;
}

/** Internal: `SdkConfig` plus optional flags consumed by the resolver. */
export interface SdkConfigEntry extends SdkConfig {
  deprecated?: boolean;
  /**
   * Explicit replacement id used in the deprecation warning. Overrides the
   * auto-suggested `<name>@<version>` form when the dash-style key cannot be
   * mechanically converted (e.g. truncated sha digests).
   */
  replacement?: string;
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
