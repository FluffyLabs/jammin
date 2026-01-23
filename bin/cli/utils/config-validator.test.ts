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

  describe("Deployment Config Validation", () => {
    test("Should parse valid deployment config with spawn and services", () => {
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
          {
            path: "./services/calculator.ts",
            name: "calculator",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {
          spawn: "local",
          services: {
            "auth-service": {
              id: 12345,
            },
            calculator: {
              id: 1234,
              storage: {
                key1: "value1",
                key2: "value2",
              },
            },
          },
        },
      };

      const result = validateBuildConfig(config);
      expect(result.deployment?.spawn).toBe("local");
      expect(result.deployment?.services).toBeDefined();
      expect(result.deployment?.services?.["auth-service"]?.id).toBe(12345);
      expect(result.deployment?.services?.calculator?.id).toBe(1234);
      expect(result.deployment?.services?.calculator?.storage).toEqual({
        key1: "value1",
        key2: "value2",
      });
    });

    test("Should parse valid deployment config with only spawn", () => {
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {
          spawn: "testnet",
        },
      };

      const result = validateBuildConfig(config);
      expect(result.deployment?.spawn).toBe("testnet");
      expect(result.deployment?.services).toBeUndefined();
    });

    test("Should parse valid deployment config with services but no IDs", () => {
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {
          spawn: "local",
          services: {
            "auth-service": {
              storage: {
                key: "value",
              },
            },
          },
        },
      };

      const result = validateBuildConfig(config);
      expect(result.deployment?.services?.["auth-service"]?.id).toBeUndefined();
      expect(result.deployment?.services?.["auth-service"]?.storage).toEqual({
        key: "value",
      });
    });

    test("Should reject deployment config with empty spawn string", () => {
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {
          spawn: "",
        },
      };

      expect(() => validateBuildConfig(config)).toThrow();
    });

    test("Should reject deployment config with missing spawn field", () => {
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {},
      };

      expect(() => validateBuildConfig(config)).toThrow();
    });

    test("Should reject deployment config with service not in build config", () => {
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {
          spawn: "local",
          services: {
            "non-existent-service": {
              id: 12345,
            },
          },
        },
      };

      expect(() => validateBuildConfig(config)).toThrow("Service 'non-existent-service' not found in build config");
    });

    test("Should reject deployment config with duplicate service IDs", () => {
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
          {
            path: "./services/calculator.ts",
            name: "calculator",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {
          spawn: "local",
          services: {
            "auth-service": {
              id: 12345,
            },
            calculator: {
              id: 12345, // Duplicate ID
            },
          },
        },
      };

      expect(() => validateBuildConfig(config)).toThrow("Service ID 12345 is already used by service 'auth-service'");
    });

    test("Should reject deployment config with negative service ID", () => {
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {
          spawn: "local",
          services: {
            "auth-service": {
              id: -1,
            },
          },
        },
      };

      expect(() => validateBuildConfig(config)).toThrow();
    });

    test("Should reject deployment config with service ID exceeding u32 max", () => {
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {
          spawn: "local",
          services: {
            "auth-service": {
              id: 4294967296, // u32 max + 1
            },
          },
        },
      };

      expect(() => validateBuildConfig(config)).toThrow();
    });

    test("Should accept deployment config with service ID at u32 max", () => {
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {
          spawn: "local",
          services: {
            "auth-service": {
              id: 4294967295, // u32 max
            },
          },
        },
      };

      const result = validateBuildConfig(config);
      expect(result.deployment?.services?.["auth-service"]?.id).toBe(4294967295);
    });

    test("Should reject deployment config with non-integer service ID", () => {
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {
          spawn: "local",
          services: {
            "auth-service": {
              id: 123.45,
            },
          },
        },
      };

      expect(() => validateBuildConfig(config)).toThrow();
    });

    test("Should accept deployment config with service ID of zero", () => {
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {
          spawn: "local",
          services: {
            "auth-service": {
              id: 0,
            },
          },
        },
      };

      const result = validateBuildConfig(config);
      expect(result.deployment?.services?.["auth-service"]?.id).toBe(0);
    });

    test("Should accept deployment config with multiple services and mixed configurations", () => {
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
          {
            path: "./services/calculator.ts",
            name: "calculator",
            sdk: "jam-sdk-0.1.26",
          },
          {
            path: "./services/storage.ts",
            name: "storage",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {
          spawn: "local",
          services: {
            "auth-service": {
              id: 1,
              storage: {
                key1: "value1",
              },
            },
            calculator: {
              id: 2,
            },
            storage: {
              storage: {
                key2: "value2",
              },
            },
          },
        },
      };

      const result = validateBuildConfig(config);
      expect(result.deployment?.services?.["auth-service"]?.id).toBe(1);
      expect(result.deployment?.services?.calculator?.id).toBe(2);
      expect(result.deployment?.services?.storage?.id).toBeUndefined();
      expect(result.deployment?.services?.storage?.storage).toEqual({
        key2: "value2",
      });
    });

    test("Should reject deployment config with non-string storage values", () => {
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {
          spawn: "local",
          services: {
            "auth-service": {
              id: 12345,
              storage: {
                key: true, // Boolean value should be rejected
              },
            },
          },
        },
      };

      expect(() => validateBuildConfig(config)).toThrow();
    });
  });

  describe("Service Info Config Validation", () => {
    test("Should parse valid info config with all fields", () => {
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {
          spawn: "local",
          services: {
            "auth-service": {
              id: 12345,
              info: {
                balance: "1000000000000",
                accumulate_min_gas: "100000",
                on_transfer_min_gas: "50000",
                storage_utilisation_bytes: "2048",
                gratis_storage: "1024",
                storage_utilisation_count: 10,
                created: 100,
                last_accumulation: 200,
                parent_service: 1,
              },
            },
          },
        },
      };

      const result = validateBuildConfig(config);
      const info = result.deployment?.services?.["auth-service"]?.info;
      expect(info).toBeDefined();
      expect(info?.balance).toBe(1000000000000n);
      expect(info?.accumulateMinGas).toBe(100000n);
      expect(info?.onTransferMinGas).toBe(50000n);
      expect(info?.storageUtilisationBytes).toBe(2048n);
      expect(info?.gratisStorage).toBe(1024n);
      expect(info?.storageUtilisationCount).toBe(10);
      expect(info?.created).toBe(100);
      expect(info?.lastAccumulation).toBe(200);
      expect(info?.parentService).toBe(1);
    });

    test("Should parse valid info config with only some fields", () => {
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {
          spawn: "local",
          services: {
            "auth-service": {
              info: {
                balance: "5000",
                created: 42,
              },
            },
          },
        },
      };

      const result = validateBuildConfig(config);
      const info = result.deployment?.services?.["auth-service"]?.info;
      expect(info).toBeDefined();
      expect(info?.balance).toBe(5000n);
      expect(info?.created).toBe(42);
      expect(info?.accumulateMinGas).toBeUndefined();
      expect(info?.onTransferMinGas).toBeUndefined();
    });

    test("Should transform snake_case info fields to camelCase", () => {
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {
          spawn: "local",
          services: {
            "auth-service": {
              info: {
                accumulate_min_gas: "1000",
                on_transfer_min_gas: "2000",
                storage_utilisation_bytes: "3000",
                gratis_storage: "4000",
                storage_utilisation_count: 5,
                last_accumulation: 6,
                parent_service: 7,
              },
            },
          },
        },
      };

      const result = validateBuildConfig(config);
      const info = result.deployment?.services?.["auth-service"]?.info;
      expect(info).toBeDefined();
      expect(info?.accumulateMinGas).toBe(1000n);
      expect(info?.onTransferMinGas).toBe(2000n);
      expect(info?.storageUtilisationBytes).toBe(3000n);
      expect(info?.gratisStorage).toBe(4000n);
      expect(info?.storageUtilisationCount).toBe(5);
      expect(info?.lastAccumulation).toBe(6);
      expect(info?.parentService).toBe(7);
    });

    test("Should accept u64 fields at max value", () => {
      const maxU64 = "18446744073709551615";
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {
          spawn: "local",
          services: {
            "auth-service": {
              info: {
                balance: maxU64,
                accumulate_min_gas: maxU64,
                on_transfer_min_gas: maxU64,
                storage_utilisation_bytes: maxU64,
                gratis_storage: maxU64,
              },
            },
          },
        },
      };

      const result = validateBuildConfig(config);
      const info = result.deployment?.services?.["auth-service"]?.info;
      expect(info?.balance).toBe(18446744073709551615n);
      expect(info?.accumulateMinGas).toBe(18446744073709551615n);
    });

    test("Should accept u32 fields at max value", () => {
      const maxU32 = 4294967295;
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {
          spawn: "local",
          services: {
            "auth-service": {
              info: {
                storage_utilisation_count: maxU32,
                created: maxU32,
                last_accumulation: maxU32,
                parent_service: maxU32,
              },
            },
          },
        },
      };

      const result = validateBuildConfig(config);
      const info = result.deployment?.services?.["auth-service"]?.info;
      expect(info?.storageUtilisationCount).toBe(maxU32);
      expect(info?.created).toBe(maxU32);
      expect(info?.lastAccumulation).toBe(maxU32);
      expect(info?.parentService).toBe(maxU32);
    });

    test("Should accept u64 fields with zero value", () => {
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {
          spawn: "local",
          services: {
            "auth-service": {
              info: {
                balance: "0",
                accumulate_min_gas: "0",
              },
            },
          },
        },
      };

      const result = validateBuildConfig(config);
      const info = result.deployment?.services?.["auth-service"]?.info;
      expect(info?.balance).toBe(0n);
      expect(info?.accumulateMinGas).toBe(0n);
    });

    test("Should accept u32 fields with zero value", () => {
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {
          spawn: "local",
          services: {
            "auth-service": {
              info: {
                storage_utilisation_count: 0,
                created: 0,
                last_accumulation: 0,
                parent_service: 0,
              },
            },
          },
        },
      };

      const result = validateBuildConfig(config);
      const info = result.deployment?.services?.["auth-service"]?.info;
      expect(info?.storageUtilisationCount).toBe(0);
      expect(info?.created).toBe(0);
    });

    test("Should reject u64 field exceeding max value", () => {
      const exceedsMaxU64 = "18446744073709551616"; // MAX_U64 + 1
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {
          spawn: "local",
          services: {
            "auth-service": {
              info: {
                balance: exceedsMaxU64,
              },
            },
          },
        },
      };

      expect(() => validateBuildConfig(config)).toThrow();
    });

    test("Should reject u32 field exceeding max value", () => {
      const exceedsMaxU32 = 4294967296; // MAX_U32 + 1
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {
          spawn: "local",
          services: {
            "auth-service": {
              info: {
                storage_utilisation_count: exceedsMaxU32,
              },
            },
          },
        },
      };

      expect(() => validateBuildConfig(config)).toThrow();
    });

    test("Should reject negative u64 field", () => {
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {
          spawn: "local",
          services: {
            "auth-service": {
              info: {
                balance: "-1",
              },
            },
          },
        },
      };

      expect(() => validateBuildConfig(config)).toThrow();
    });

    test("Should reject negative u32 field", () => {
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {
          spawn: "local",
          services: {
            "auth-service": {
              info: {
                created: -1,
              },
            },
          },
        },
      };

      expect(() => validateBuildConfig(config)).toThrow();
    });

    test("Should reject u64 field provided as number instead of string", () => {
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {
          spawn: "local",
          services: {
            "auth-service": {
              info: {
                balance: 1000000, // Should be a string
              },
            },
          },
        },
      };

      expect(() => validateBuildConfig(config)).toThrow();
    });

    test("Should reject u64 field with invalid string", () => {
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {
          spawn: "local",
          services: {
            "auth-service": {
              info: {
                balance: "not-a-number",
              },
            },
          },
        },
      };

      expect(() => validateBuildConfig(config)).toThrow();
    });

    test("Should reject non-integer u32 field", () => {
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {
          spawn: "local",
          services: {
            "auth-service": {
              info: {
                created: 123.45,
              },
            },
          },
        },
      };

      expect(() => validateBuildConfig(config)).toThrow();
    });

    test("Should reject u32 field provided as string", () => {
      const config = {
        services: [
          {
            path: "./services/auth.ts",
            name: "auth-service",
            sdk: "jam-sdk-0.1.26",
          },
        ],
        deployment: {
          spawn: "local",
          services: {
            "auth-service": {
              info: {
                created: "100",
              },
            },
          },
        },
      };

      expect(() => validateBuildConfig(config)).toThrow();
    });
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
