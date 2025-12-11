import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { ConfigError } from "../types/errors";
import { loadBuildConfig } from "./config-loader";

const VALID_BUILD = "./test-files/valid-build.yml";
const INVALID_BUILD = "./test-files/invalid-build.yml";

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
