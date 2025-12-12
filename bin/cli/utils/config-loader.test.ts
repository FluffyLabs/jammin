import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { ConfigError } from "../types/errors";
import { loadBuildConfig, loadNetworksConfig } from "./config-loader";

const VALID_BUILD = "./test-files/valid-build.yml";
const INVALID_BUILD = "./test-files/invalid-build.yml";
const VALID_NETWORKS = "./test-files/valid-networks.yml";
const INVALID_NETWORKS = "./test-files/invalid-networks.yml";

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

    expect(config.deployment).toBeDefined();
    expect(config.deployment?.spawn).toBe("local");
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
    const configPath = resolve(__dirname, VALID_NETWORKS);
    const config = await loadNetworksConfig(configPath);

    expect(config.networks).toBeDefined();
    expect(Object.keys(config.networks).length).toBeGreaterThan(0);
    expect(config.networks.local).toBeDefined();
  });

  test("Should load config with multiple node definitions", async () => {
    const configPath = resolve(__dirname, VALID_NETWORKS);
    const config = await loadNetworksConfig(configPath);

    expect(config.networks.local).toBeDefined();
    if (Array.isArray(config.networks.local)) {
      expect(config.networks.local.length).toBeGreaterThan(0);
      expect(config.networks.local[0]?.image).toBe("typeberry-0.4.1");
      expect(config.networks.local[0]?.args).toBe("dev");
      expect(config.networks.local[0]?.instances).toBe(4);
    }
  });

  test("Should load config with compose network definition", async () => {
    const configPath = resolve(__dirname, VALID_NETWORKS);
    const config = await loadNetworksConfig(configPath);

    expect(config.networks.staging).toBeDefined();
    if (!Array.isArray(config.networks.staging)) {
      expect(config.networks.staging?.compose).toBe("./docker-compose.staging.yml");
    }
  });

  test("Should load config with multiple networks", async () => {
    const configPath = resolve(__dirname, VALID_NETWORKS);
    const config = await loadNetworksConfig(configPath);

    const networkNames = Object.keys(config.networks);
    expect(networkNames.length).toBeGreaterThanOrEqual(2);
    expect(networkNames).toContain("local");
    expect(networkNames).toContain("staging");
  });

  test("Should throw ConfigError for invalid networks config file", async () => {
    const configPath = resolve(__dirname, INVALID_NETWORKS);

    expect(loadNetworksConfig(configPath)).rejects.toThrow(ConfigError);
  });

  test("Should throw ConfigError for non-existent file", async () => {
    const configPath = resolve(__dirname, "nonexistent-networks.yml");

    expect(loadNetworksConfig(configPath)).rejects.toThrow(ConfigError);
  });
});
