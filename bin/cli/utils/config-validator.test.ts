import { describe, expect, test } from "bun:test";
import { validateBuildConfig } from "./config-validator";

describe("Validate Build Config", () => {
  test("Should parse valid build config with all fields", () => {
    const validConfig = {
      services: [
        {
          path: "./services/auth.ts",
          name: "auth-service",
          sdk: "jam-sdk-0.1.26",
        },
      ],
      deployment: {
        spawn: "local",
      },
    };

    const result = validateBuildConfig(validConfig);
    expect(result.services).toHaveLength(1);
    expect(result.services[0]?.name).toBe("auth-service");
    expect(result.deployment?.spawn).toBe("local");
  });

  test("Should parse minimal valid build config", () => {
    const minimalConfig = {
      services: [
        {
          path: "./service.ts",
          name: "my-service",
          sdk: "jam-sdk-0.1.26",
        },
      ],
    };

    const result = validateBuildConfig(minimalConfig);
    expect(result.services).toHaveLength(1);
    expect(result.deployment).toBeUndefined();
  });

  test("Should reject config with invalid service name", () => {
    const invalidConfig = {
      services: [
        {
          path: "./service.ts",
          name: "invalid service!@#",
          sdk: "jam-sdk",
        },
      ],
    };

    expect(() => validateBuildConfig(invalidConfig)).toThrow();
  });

  test("Should reject config with empty services array", () => {
    const invalidConfig = {
      services: [],
    };

    expect(() => validateBuildConfig(invalidConfig)).toThrow("At least one service is required");
  });

  test("Should reject config with missing required service fields", () => {
    const invalidConfig = {
      services: [
        {
          path: "./service.ts",
          // missing name and sdk
        },
      ],
    };

    expect(() => validateBuildConfig(invalidConfig)).toThrow();
  });

  test("Should accept inline custom SDK configuration", () => {
    const config = {
      services: [
        {
          path: "./service.ts",
          name: "custom-service",
          sdk: {
            image: "custom/sdk:v2.0",
            build: "bun run custom:build",
            test: "bun run custom:test",
          },
        },
      ],
    };

    const result = validateBuildConfig(config);
    expect(result.services).toHaveLength(1);
    expect(result.services[0]?.name).toBe("custom-service");
    expect(result.services[0]?.sdk).toEqual({
      image: "custom/sdk:v2.0",
      build: "bun run custom:build",
      test: "bun run custom:test",
    });
  });

  test("Should accept mix of string SDK and inline custom SDK", () => {
    const config = {
      services: [
        {
          path: "./service1.ts",
          name: "builtin-service",
          sdk: "jam-sdk-0.1.26",
        },
        {
          path: "./service2.ts",
          name: "custom-service",
          sdk: {
            image: "my/sdk:latest",
            build: "make build",
            test: "make test",
          },
        },
      ],
    };

    const result = validateBuildConfig(config);
    expect(result.services).toHaveLength(2);
    expect(result.services[0]?.sdk).toBe("jam-sdk-0.1.26");
    expect(typeof result.services[1]?.sdk).toBe("object");
  });

  test("Should reject inline custom SDK with missing fields", () => {
    const config = {
      services: [
        {
          path: "./service.ts",
          name: "service",
          sdk: {
            image: "custom/sdk:v1",
            // missing build and test
          },
        },
      ],
    };

    expect(() => validateBuildConfig(config)).toThrow();
  });

  test("Should reject inline custom SDK with empty strings", () => {
    const config = {
      services: [
        {
          path: "./service.ts",
          name: "service",
          sdk: {
            image: "",
            build: "bun run build",
            test: "bun test",
          },
        },
      ],
    };

    expect(() => validateBuildConfig(config)).toThrow("SDK image is required");
  });
});
