import { describe, expect, test } from "bun:test";
import { validateBuildConfig, validateNetworksConfig } from "./config-validator";

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

describe("Validate Networks Config", () => {
  test("Should parse valid networks config with node definitions", () => {
    const validConfig = {
      networks: {
        local: [
          {
            image: "typeberry-0.4.1",
            args: "dev",
            instances: 4,
          },
          {
            image: "polkajam-v0.1.26",
            instances: 2,
          },
        ],
      },
    };

    const result = validateNetworksConfig(validConfig);
    expect(result.networks.local).toBeDefined();
    expect(Array.isArray(result.networks.local)).toBe(true);
    if (Array.isArray(result.networks.local)) {
      expect(result.networks.local).toHaveLength(2);
      expect(result.networks.local[0]?.image).toBe("typeberry-0.4.1");
      expect(result.networks.local[0]?.instances).toBe(4);
    }
  });

  test("Should parse valid networks config with compose network", () => {
    const validConfig = {
      networks: {
        test: {
          compose: "./docker-compose.test.yml",
        },
      },
    };

    const result = validateNetworksConfig(validConfig);
    expect(result.networks.test).toBeDefined();
    if (!Array.isArray(result.networks.test)) {
      expect(result.networks.test?.compose).toBe("./docker-compose.test.yml");
    }
  });

  test("Should parse config with multiple networks", () => {
    const validConfig = {
      networks: {
        local: [
          {
            image: "typeberry-0.4.1",
            args: "dev",
          },
        ],
        test: {
          compose: "./docker-compose.test.yml",
        },
      },
    };

    const result = validateNetworksConfig(validConfig);
    expect(Object.keys(result.networks)).toHaveLength(2);
    expect(result.networks.local).toBeDefined();
    expect(result.networks.test).toBeDefined();
  });

  test("Should accept node definition with only required image field", () => {
    const config = {
      networks: {
        local: [
          {
            image: "typeberry-0.4.1",
          },
        ],
      },
    };

    const result = validateNetworksConfig(config);
    expect(result.networks.local).toBeDefined();
    if (Array.isArray(result.networks.local)) {
      expect(result.networks.local[0]?.image).toBe("typeberry-0.4.1");
      expect(result.networks.local[0]?.instances).toBe(1);
      expect(result.networks.local[0]?.args).toBeUndefined();
    }
  });

  test("Should reject config with empty networks object", () => {
    const invalidConfig = {
      networks: {},
    };

    expect(() => validateNetworksConfig(invalidConfig)).toThrow("At least one network must be defined");
  });

  test("Should reject config without networks field", () => {
    const invalidConfig = {};

    expect(() => validateNetworksConfig(invalidConfig)).toThrow();
  });

  test("Should reject node definition with empty image string", () => {
    const invalidConfig = {
      networks: {
        local: [
          {
            image: "",
            args: "dev",
          },
        ],
      },
    };

    expect(() => validateNetworksConfig(invalidConfig)).toThrow("Node image is required");
  });

  test("Should reject node definition with missing image field", () => {
    const invalidConfig = {
      networks: {
        local: [
          {
            args: "dev",
            instances: 2,
          },
        ],
      },
    };

    expect(() => validateNetworksConfig(invalidConfig)).toThrow();
  });

  test("Should reject compose network with empty compose path", () => {
    const invalidConfig = {
      networks: {
        test: {
          compose: "",
        },
      },
    };

    expect(() => validateNetworksConfig(invalidConfig)).toThrow("Docker compose file path is required");
  });

  test("Should reject node definition with negative instances", () => {
    const invalidConfig = {
      networks: {
        local: [
          {
            image: "typeberry-0.4.1",
            instances: -1,
          },
        ],
      },
    };

    expect(() => validateNetworksConfig(invalidConfig)).toThrow("Too small: expected number to be >0");
  });

  test("Should reject node definition with zero instances", () => {
    const invalidConfig = {
      networks: {
        local: [
          {
            image: "typeberry-0.4.1",
            instances: 0,
          },
        ],
      },
    };

    expect(() => validateNetworksConfig(invalidConfig)).toThrow();
  });

  test("Should reject node definition with non-integer instances", () => {
    const invalidConfig = {
      networks: {
        local: [
          {
            image: "typeberry-0.4.1",
            instances: 2.5,
          },
        ],
      },
    };

    expect(() => validateNetworksConfig(invalidConfig)).toThrow();
  });
});
