// Core configuration types matching YAML schema

// jammin.build.yml types

export interface JamminBuildConfig {
  services: ServiceConfig[];
  deployment?: DeploymentConfig;
}

export interface ServiceConfig {
  path: string; // Path to service file (any programming language)
  name: string; // Service identifier
  sdk: string | CustomSdkConfig; // SDK name (built-in) or custom sdk
}

export interface CustomSdkConfig {
  image: string; // Docker image name
  build: string; // Build command
  test: string; // Test command
}

export interface DeploymentConfig {
  spawn: string; // Network name to spawn
}
