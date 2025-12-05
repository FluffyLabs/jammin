import { describe, expect, test } from "bun:test";
import type { ResolvedServiceConfig } from "../types/config";
import { filterServices } from "./config-loader";

describe("Config Loader", () => {
  test("filterServices returns all services when no filter provided", () => {
    const services: ResolvedServiceConfig[] = [
      {
        path: "./service-a",
        name: "serviceA",
        sdk: "test-sdk",
        absolutePath: "/abs/service-a",
        sdkConfig: {
          type: "builtin",
          buildCommand: "build",
          testCommand: "test",
        },
      },
      {
        path: "./service-b",
        name: "serviceB",
        sdk: "test-sdk",
        absolutePath: "/abs/service-b",
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

  test("filterServices returns specific service when filter provided", () => {
    const services: ResolvedServiceConfig[] = [
      {
        path: "./service-a",
        name: "serviceA",
        sdk: "test-sdk",
        absolutePath: "/abs/service-a",
        sdkConfig: {
          type: "builtin",
          buildCommand: "build",
          testCommand: "test",
        },
      },
      {
        path: "./service-b",
        name: "serviceB",
        sdk: "test-sdk",
        absolutePath: "/abs/service-b",
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
});
