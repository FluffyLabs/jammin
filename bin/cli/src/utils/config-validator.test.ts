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
      sdks: {
        "custom-sdk": {
          image: "custom/sdk:v1",
          build: "npm run build",
          test: "npm test",
        },
      },
      deployment: {
        spawn: "local",
        version: "1.0.0",
        deploy_with: "bootstrap-service",
        upgrade: true,
      },
    };

    const result = validateBuildConfig(validConfig);
    expect(result.services).toHaveLength(1);
    expect(result.services[0]?.name).toBe("auth-service");
    expect(result.deployment?.version).toBe("1.0.0");
    expect(result.deployment?.deploy_with).toBe("bootstrap-service");
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
    expect(result.sdks).toBeUndefined();
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

  test("Should reject config with invalid deployment.deploy_with value", () => {
    const invalidConfig = {
      services: [
        {
          path: "./service.ts",
          name: "service",
          sdk: "sdk",
        },
      ],
      deployment: {
        spawn: "local",
        version: "1.0.0",
        deploy_with: "invalid-method",
      },
    };

    expect(() => validateBuildConfig(invalidConfig)).toThrow();
  });

  test("Should reject config with invalid SDK definition", () => {
    const invalidConfig = {
      services: [
        {
          path: "./service.ts",
          name: "service",
          sdk: "custom-sdk",
        },
      ],
      sdks: {
        "custom-sdk": {
          image: "image:v1",
          // missing build and test
        },
      },
    };

    expect(() => validateBuildConfig(invalidConfig)).toThrow();
  });

  test("Should accept valid semantic version formats", () => {
    const validVersions = ["1.0.0", "0.0.1", "10.20.30", "1.0.0-alpha", "1.0.0-beta.1", "1.0.0+build.123"];

    validVersions.forEach((version) => {
      const config = {
        services: [{ path: "./service.ts", name: "service", sdk: "sdk" }],
        deployment: {
          spawn: "local",
          version,
          deploy_with: "genesis",
        },
      };

      const result = validateBuildConfig(config);
      expect(result.deployment?.version).toBe(version);
    });
  });

  test("Should reject invalid version formats", () => {
    const invalidVersions = ["1.0", "v1.0.0", "1", "1.0.0.0", "abc", "1.0.x"];

    invalidVersions.forEach((version) => {
      const config = {
        services: [{ path: "./service/main.ts", name: "service", sdk: "sdk" }],
        deployment: {
          spawn: "local",
          version,
          deploy_with: "genesis",
        },
      };

      expect(() => validateBuildConfig(config)).toThrow();
    });
  });

  test("Should accept valid file paths with extensions", () => {
    const validPaths = [
      "./services/auth.ts",
      "services/handler.rs",
      "./src/main.go",
      "app.py",
      "./lib/service.test.ts",
      ".gitignore",
      "./config/.env",
    ];

    validPaths.forEach((path) => {
      const config = {
        services: [{ path, name: "service", sdk: "sdk" }],
      };

      const result = validateBuildConfig(config);
      expect(result.services[0]?.path).toBe(path);
    });
  });

  test("Should reject directory paths without extensions", () => {
    const invalidPaths = ["./services/auth", "services", "./src", "app", "./services/"];

    invalidPaths.forEach((path) => {
      const config = {
        services: [{ path, name: "service", sdk: "sdk" }],
      };

      expect(() => validateBuildConfig(config)).toThrow("Path must point to a file");
    });
  });

  test("Should reject paths ending with trailing slash", () => {
    const config = {
      services: [{ path: "./services/auth/", name: "service", sdk: "sdk" }],
    };

    expect(() => validateBuildConfig(config)).toThrow("Path must point to a file");
  });

  test("Should reject paths with dot at the end", () => {
    const config = {
      services: [{ path: "./services/file.", name: "service", sdk: "sdk" }],
    };

    expect(() => validateBuildConfig(config)).toThrow("Path must point to a file");
  });
});

describe("Validate Networks Config", () => {
  test("Should parse valid networks config with container definitions", () => {
    const validConfig = {
      networks: {
        local: [
          {
            image: "typeberry-0.4.1",
            args: "dev --unsafe-rpc-external",
            instances: 2,
          },
        ],
      },
    };

    const result = validateNetworksConfig(validConfig);
    expect(result.networks.local).toBeDefined();
    expect(Array.isArray(result.networks.local)).toBe(true);
  });

  test("Should parse valid networks config with compose definition", () => {
    const validConfig = {
      networks: {
        staging: {
          compose: "./docker-compose.staging.yml",
        },
      },
    };

    const result = validateNetworksConfig(validConfig);
    expect(result.networks.staging).toBeDefined();
    expect((result.networks.staging as { compose: string }).compose).toBe("./docker-compose.staging.yml");
  });

  test("Should parse minimal container definition with defaults", () => {
    const validConfig = {
      networks: {
        minimal: [
          {
            image: "typeberry-0.4.1",
          },
        ],
      },
    };

    const result = validateNetworksConfig(validConfig);
    expect(Array.isArray(result.networks.minimal)).toBe(true);
    expect((result.networks.minimal as Array<{ image: string; instances: number }>)[0]?.instances).toBe(1);
  });

  test("Should parse multiple networks with different types", () => {
    const validConfig = {
      networks: {
        local: [{ image: "typeberry" }],
        staging: { compose: "./compose.yml" },
      },
    };

    const result = validateNetworksConfig(validConfig);
    expect(Object.keys(result.networks)).toHaveLength(2);
  });

  test("Should reject config with empty image string", () => {
    const invalidConfig = {
      networks: {
        local: [
          {
            image: "",
          },
        ],
      },
    };

    expect(() => validateNetworksConfig(invalidConfig)).toThrow();
  });

  test("Should reject config with invalid instances value", () => {
    const invalidConfig = {
      networks: {
        local: [
          {
            image: "typeberry",
            instances: -1,
          },
        ],
      },
    };

    expect(() => validateNetworksConfig(invalidConfig)).toThrow();
  });

  test("Should reject compose config with empty compose path", () => {
    const invalidConfig = {
      networks: {
        staging: {
          compose: "",
        },
      },
    };

    expect(() => validateNetworksConfig(invalidConfig)).toThrow();
  });

  test("Should reject config with no networks defined", () => {
    const invalidConfig = {
      networks: {},
    };

    expect(() => validateNetworksConfig(invalidConfig)).toThrow("At least one network must be defined");
  });
});
