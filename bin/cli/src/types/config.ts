// Core configuration types matching YAML schema

// jammin.build.yml types

export interface JamminBuildConfig {
  services: ServiceConfig[];
  sdks?: Record<string, CustomSdkConfig>;
  deployment?: DeploymentConfig;
}

export interface ServiceConfig {
  path: string; // Path to service file (any programming language)
  name: string; // Service identifier
  sdk: string; // SDK name (built-in or custom)
}

export interface CustomSdkConfig {
  image: string; // Docker image name
  build: string; // Build command
  test: string; // Test command
}

export interface DeploymentConfig {
  spawn: string; // Network name to spawn
  version: string;
  deploy_with: "bootstrap-service" | "genesis";
  upgrade?: boolean;
}

// jammin.networks.yml types

export interface JamminNetworksConfig {
  networks: Record<string, NetworkConfig>;
}

export type NetworkConfig = ContainerDefinition[] | ComposeNetworkConfig;

export interface ContainerDefinition {
  image: string;
  args?: string;
  instances?: number;
}

export interface ComposeNetworkConfig {
  compose: string; // Path to docker-compose file
}

// Runtime types

export interface ResolvedServiceConfig extends ServiceConfig {
  absolutePath: string; // Resolved absolute path
  sdkConfig: SdkConfig; // Resolved SDK configuration
}

export interface SdkConfig {
  type: "builtin" | "custom";
  buildCommand: string;
  testCommand: string;
  image?: string; // Only for custom SDKs
}

// Execution results

export interface ServiceExecutionResult {
  serviceName: string;
  success: boolean;
  output?: string;
  error?: string;
  duration: number; // milliseconds
}

export interface ExecutionSummary {
  total: number;
  successful: number;
  failed: number;
  results: ServiceExecutionResult[];
}
