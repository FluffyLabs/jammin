// Core configuration types matching YAML schema

// jammin.build.yml types

export interface JamminBuildConfig {
  services: ServiceConfig[];
  deployment?: DeploymentConfig;
}

export interface ServiceConfig {
  /** Path to service directory */
  path: string;
  /** Service identifier */
  name: string;
  /** SDK name (built-in) or custom sdk */
  sdk: string | SdkConfig;
}

export interface SdkConfig {
  /** Docker image name */
  image: string;
  /** Build command */
  build: string;
  /** Test command */
  test: string;
}

export interface DeploymentConfig {
  /** Network name to spawn */
  spawn: string;
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
