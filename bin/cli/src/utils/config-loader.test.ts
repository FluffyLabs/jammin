import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import type { ResolvedServiceConfig } from "../types/config";
import { ConfigError } from "../types/errors";
import { filterServices, loadBuildConfig, loadNetworksConfig, resolveServices } from "./config-loader";

const VALID_BUILD = "./test-files/valid-build.yml";
const INVALID_BUILD = "./test-files/invalid-build.yml";
const VALID_NETWORK = "./test-files/valid-network.yml";

describe("Config Loader - filterServices", () => {
  test("Filter Services returns all services when no filter provided", () => {
    const services: ResolvedServiceConfig[] = [
      {
        path: "./service-a.ts",
        name: "serviceA",
        sdk: "test-sdk",
        absolutePath: "/abs/service-a.ts",
        sdkConfig: {
          type: "builtin",
          buildCommand: "build",
          testCommand: "test",
        },
      },
      {
        path: "./service-b.rs",
        name: "serviceB",
        sdk: "test-sdk",
        absolutePath: "/abs/service-b.rs",
        sdkConfig: {
          type: "builtin",
          buildCommand: "build",
          testCommand: "test",
        },
      },
    ];

    const result = filterServices(services);
    expect(result).toHaveLength(2);
  });

  test("Filter Services returns specific service when filter provided", () => {
    const services: ResolvedServiceConfig[] = [
      {
        path: "./service-a.ts",
        name: "serviceA",
        sdk: "test-sdk",
        absolutePath: "/abs/service-a.ts",
        sdkConfig: {
          type: "builtin",
          buildCommand: "build",
          testCommand: "test",
        },
      },
      {
        path: "./service-b.rs",
        name: "serviceB",
        sdk: "test-sdk",
        absolutePath: "/abs/service-b.rs",
        sdkConfig: {
          type: "builtin",
          buildCommand: "build",
          testCommand: "test",
        },
      },
    ];

    const result = filterServices(services, "serviceA");
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("serviceA");
  });

  test("Filter Services returns empty array when no match found", () => {
    const services: ResolvedServiceConfig[] = [
      {
        path: "./service-a.ts",
        name: "serviceA",
        sdk: "test-sdk",
        absolutePath: "/abs/service-a.ts",
        sdkConfig: {
          type: "builtin",
          buildCommand: "build",
          testCommand: "test",
        },
      },
    ];

    const result = filterServices(services, "nonexistent");
    expect(result).toHaveLength(0);
  });
});

describe("Config Loader - loadBuildConfig", () => {
  test("Should load and parse valid build config from file", async () => {
    const configPath = resolve(__dirname, VALID_BUILD);
    const config = await loadBuildConfig(configPath);

    expect(config.services).toBeDefined();
    expect(config.services.length).toBeGreaterThan(0);
    expect(config.services[0]?.name).toBe("auth-service");
    expect(config.services[0]?.sdk).toBe("jam-sdk-0.1.26");
  });

  test("Should load config with custom SDKs and deployment", async () => {
    const configPath = resolve(__dirname, VALID_BUILD);
    const config = await loadBuildConfig(configPath);

    expect(config.sdks).toBeDefined();
    expect(config.sdks?.["custom-polkajam"]).toBeDefined();
    expect(config.sdks?.["custom-polkajam"]?.image).toBe("polkajam/sdk:v1.2.0");
    expect(config.deployment).toBeDefined();
    expect(config.deployment?.deploy_with).toBe("bootstrap-service");
  });

  test("Should throw ConfigError for invalid build config file", async () => {
    const configPath = resolve(__dirname, INVALID_BUILD);

    expect(loadBuildConfig(configPath)).rejects.toThrow(ConfigError);
  });

  test("Should throw ConfigError for non-existent file", async () => {
    const configPath = resolve(__dirname, "nonexistent-config.yml");

    expect(loadBuildConfig(configPath)).rejects.toThrow(ConfigError);
  });
});

describe("Config Loader - loadNetworksConfig", () => {
  test("Should load and parse valid networks config from file", async () => {
    const configPath = resolve(__dirname, VALID_NETWORK);
    const config = await loadNetworksConfig(configPath);

    expect(config.networks).toBeDefined();
    expect(Object.keys(config.networks).length).toBeGreaterThan(0);
  });

  test("Should load config with container-based network", async () => {
    const configPath = resolve(__dirname, VALID_NETWORK);
    const config = await loadNetworksConfig(configPath);

    expect(config.networks.local).toBeDefined();
    expect(Array.isArray(config.networks.local)).toBe(true);
    const localNetwork = config.networks.local as Array<{ image: string; instances?: number }>;
    expect(localNetwork[0]?.image).toBe("typeberry-0.4.1");
    expect(localNetwork[0]?.instances).toBe(2);
  });

  test("Should load config with compose-based network", async () => {
    const configPath = resolve(__dirname, VALID_NETWORK);
    const config = await loadNetworksConfig(configPath);

    expect(config.networks.staging).toBeDefined();
    const stagingNetwork = config.networks.staging as { compose: string };
    expect(stagingNetwork.compose).toBe("./docker-compose.staging.yml");
  });

  test("Should throw ConfigError for non-existent file", async () => {
    const configPath = resolve(__dirname, "nonexistent-network.yml");

    expect(loadNetworksConfig(configPath)).rejects.toThrow(ConfigError);
  });
});

describe("Config Loader - resolveServices", () => {
  test("Should resolve services with built-in SDK", async () => {
    const config = {
      services: [
        {
          path: "../config-loader.test.ts",
          name: "test-service",
          sdk: "jam-sdk-0.1.26",
        },
      ],
    };

    const configPath = resolve(__dirname, VALID_BUILD);
    const resolved = await resolveServices(config, configPath);

    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.name).toBe("test-service");
    expect(resolved[0]?.sdk).toBe("jam-sdk-0.1.26");
    expect(resolved[0]?.absolutePath).toBeDefined();
    expect(resolved[0]?.sdkConfig.type).toBe("builtin");
    expect(resolved[0]?.sdkConfig.buildCommand).toBe("bun run build");
    expect(resolved[0]?.sdkConfig.testCommand).toBe("bun test");
  });

  test("Should resolve services with custom SDK", async () => {
    const config = {
      services: [
        {
          path: "../config-validator.test.ts",
          name: "custom-service",
          sdk: "my-custom-sdk",
        },
      ],
      sdks: {
        "my-custom-sdk": {
          image: "custom/sdk:v1",
          build: "bun run custom:build",
          test: "bun run custom:test",
        },
      },
    };

    const configPath = resolve(__dirname, VALID_BUILD);
    const resolved = await resolveServices(config, configPath);

    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.sdkConfig.type).toBe("custom");
    expect(resolved[0]?.sdkConfig.buildCommand).toBe("bun run custom:build");
    expect(resolved[0]?.sdkConfig.testCommand).toBe("bun run custom:test");
    if (resolved[0]?.sdkConfig.type === "custom") {
      expect(resolved[0].sdkConfig.image).toBe("custom/sdk:v1");
    }
  });

  test("Should resolve multiple services", async () => {
    const config = {
      services: [
        {
          path: "../config-loader.test.ts",
          name: "service-a",
          sdk: "jam-sdk-0.1.26",
        },
        {
          path: "../config-validator.test.ts",
          name: "service-b",
          sdk: "jam-sdk-0.1.26",
        },
      ],
    };

    const configPath = resolve(__dirname, VALID_BUILD);
    const resolved = await resolveServices(config, configPath);

    expect(resolved).toHaveLength(2);
    expect(resolved[0]?.name).toBe("service-a");
    expect(resolved[1]?.name).toBe("service-b");
    expect(resolved[0]?.absolutePath).toBeDefined();
    expect(resolved[1]?.absolutePath).toBeDefined();
  });

  test("Should resolve absolute paths correctly", async () => {
    const config = {
      services: [
        {
          path: "../config-loader.test.ts",
          name: "test-service",
          sdk: "jam-sdk-0.1.26",
        },
      ],
    };

    const configPath = resolve(__dirname, VALID_BUILD);
    const resolved = await resolveServices(config, configPath);

    expect(resolved[0]?.absolutePath).toContain(__dirname);
  });

  test("Should throw ConfigError when service path does not exist", async () => {
    const config = {
      services: [
        {
          path: "../this-directory-absolutely-does-not-exist-12345",
          name: "missing-service",
          sdk: "jam-sdk-0.1.26",
        },
      ],
    };

    const configPath = resolve(__dirname, VALID_BUILD);

    expect(resolveServices(config, configPath)).rejects.toThrow(ConfigError);
    expect(resolveServices(config, configPath)).rejects.toThrow(/Service file does not exist/);
  });

  test("Should throw ConfigError when SDK is unknown", async () => {
    const config = {
      services: [
        {
          path: "../config-loader.test.ts",
          name: "test-service",
          sdk: "nonexistent-sdk",
        },
      ],
    };

    const configPath = resolve(__dirname, VALID_BUILD);

    expect(resolveServices(config, configPath)).rejects.toThrow(ConfigError);
    expect(resolveServices(config, configPath)).rejects.toThrow(/Unknown SDK/);
  });

  test("Should preserve all service properties", async () => {
    const config = {
      services: [
        {
          path: "../config-loader.test.ts",
          name: "test-service",
          sdk: "jam-sdk-0.1.26",
        },
      ],
    };

    const configPath = resolve(__dirname, VALID_BUILD);
    const resolved = await resolveServices(config, configPath);

    expect(resolved[0]).toMatchObject({
      path: "../config-loader.test.ts",
      name: "test-service",
      sdk: "jam-sdk-0.1.26",
    });
    expect(resolved[0]?.absolutePath).toBeDefined();
    expect(resolved[0]?.sdkConfig).toBeDefined();
  });

  test("Should work with mix of built-in and custom SDKs", async () => {
    const config = {
      services: [
        {
          path: "../config-loader.test.ts",
          name: "builtin-service",
          sdk: "jam-sdk-0.1.26",
        },
        {
          path: "../config-validator.test.ts",
          name: "custom-service",
          sdk: "custom-sdk",
        },
      ],
      sdks: {
        "custom-sdk": {
          image: "custom/image:v1",
          build: "custom build",
          test: "custom test",
        },
      },
    };

    const configPath = resolve(__dirname, VALID_BUILD);
    const resolved = await resolveServices(config, configPath);

    expect(resolved).toHaveLength(2);
    expect(resolved[0]?.sdkConfig.type).toBe("builtin");
    expect(resolved[1]?.sdkConfig.type).toBe("custom");
  });
});
