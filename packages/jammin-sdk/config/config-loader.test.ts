import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadBuildConfig, loadNetworksConfig } from "./config-loader.js";
import { ConfigError } from "./types/errors.js";

const FIXTURES = {
  validBuild: resolve(__dirname, "./test-files/valid-build.yml"),
  invalidBuild: resolve(__dirname, "./test-files/invalid-build.yml"),
  validNetworks: resolve(__dirname, "./test-files/valid-networks.yml"),
  invalidNetworks: resolve(__dirname, "./test-files/invalid-networks.yml"),
};

let originalCwd: () => string;
let testCwd: string;

async function setupTestCwd(): Promise<void> {
  testCwd = join(tmpdir(), `jammin-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(testCwd, { recursive: true });
  // Drop a .git marker so findConfigFile stops walking parents.
  await mkdir(join(testCwd, ".git"), { recursive: true });
  originalCwd = process.cwd;
  process.cwd = mock(() => testCwd);
}

async function teardownTestCwd(): Promise<void> {
  process.cwd = originalCwd;
  await rm(testCwd, { recursive: true }).catch(() => {});
}

describe("Config Loader - loadBuildConfig", () => {
  beforeEach(setupTestCwd);
  afterEach(teardownTestCwd);

  test("Should load and parse valid build config from file", async () => {
    await copyFile(FIXTURES.validBuild, join(testCwd, "jammin.build.yml"));
    const config = await loadBuildConfig();

    expect(config.services).toBeDefined();
    expect(config.services.length).toBeGreaterThan(0);
    expect(config.services[0]?.name).toBe("auth-service");
    expect(config.services[0]?.sdk).toBe("jam-sdk-0.1.26");
  });

  test("Should load config with custom SDKs and deployment", async () => {
    await copyFile(FIXTURES.validBuild, join(testCwd, "jammin.build.yml"));
    const config = await loadBuildConfig();

    expect(config.deployment).toBeDefined();
    expect(config.deployment?.spawn).toBe("local");
  });

  test("Should throw ConfigError for invalid build config file", async () => {
    await copyFile(FIXTURES.invalidBuild, join(testCwd, "jammin.build.yml"));

    expect(loadBuildConfig()).rejects.toThrow(ConfigError);
  });

  test("Should throw ConfigError when no config file is found", async () => {
    expect(loadBuildConfig()).rejects.toThrow(ConfigError);
  });

  test("Should walk up parent directories to find config", async () => {
    await copyFile(FIXTURES.validBuild, join(testCwd, "jammin.build.yml"));
    const nestedCwd = join(testCwd, "services", "auth");
    await mkdir(nestedCwd, { recursive: true });
    process.cwd = mock(() => nestedCwd);

    const config = await loadBuildConfig();

    expect(config.services[0]?.name).toBe("auth-service");
  });
});

describe("Config Loader - loadNetworksConfig", () => {
  beforeEach(setupTestCwd);
  afterEach(teardownTestCwd);

  test("Should load and parse valid networks config from file", async () => {
    await copyFile(FIXTURES.validNetworks, join(testCwd, "jammin.networks.yml"));
    const config = await loadNetworksConfig();

    expect(config.networks).toBeDefined();
    expect(Object.keys(config.networks).length).toBeGreaterThan(0);
    expect(config.networks.local).toBeDefined();
  });

  test("Should load config with multiple node definitions", async () => {
    await copyFile(FIXTURES.validNetworks, join(testCwd, "jammin.networks.yml"));
    const config = await loadNetworksConfig();

    expect(config.networks.local).toBeDefined();
    if (Array.isArray(config.networks.local)) {
      expect(config.networks.local.length).toBeGreaterThan(0);
      expect(config.networks.local[0]?.image).toBe("typeberry-0.4.1");
      expect(config.networks.local[0]?.args).toBe("dev");
      expect(config.networks.local[0]?.instances).toBe(4);
    }
  });

  test("Should load config with compose network definition", async () => {
    await copyFile(FIXTURES.validNetworks, join(testCwd, "jammin.networks.yml"));
    const config = await loadNetworksConfig();

    expect(config.networks.staging).toBeDefined();
    if (!Array.isArray(config.networks.staging)) {
      expect(config.networks.staging?.compose).toBe("./docker-compose.staging.yml");
    }
  });

  test("Should load config with multiple networks", async () => {
    await copyFile(FIXTURES.validNetworks, join(testCwd, "jammin.networks.yml"));
    const config = await loadNetworksConfig();

    const networkNames = Object.keys(config.networks);
    expect(networkNames.length).toBeGreaterThanOrEqual(2);
    expect(networkNames).toContain("local");
    expect(networkNames).toContain("staging");
  });

  test("Should throw ConfigError for invalid networks config file", async () => {
    await copyFile(FIXTURES.invalidNetworks, join(testCwd, "jammin.networks.yml"));

    expect(loadNetworksConfig()).rejects.toThrow(ConfigError);
  });

  test("Should throw ConfigError when no config file is found", async () => {
    expect(loadNetworksConfig()).rejects.toThrow(ConfigError);
  });
});
