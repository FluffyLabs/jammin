import { describe, expect, test } from "bun:test";
import { resolveSdkId, SDK_ALIASES, SDK_CONFIGS } from "./sdk-configs.js";
import type { ServiceConfig } from "./types/config.js";

describe("SDK_ALIASES", () => {
  test("Every alias target points to a canonical SDK_CONFIGS key", () => {
    for (const target of Object.values(SDK_ALIASES)) {
      expect(Object.hasOwn(SDK_CONFIGS, target)).toBe(true);
    }
  });

  test("Bare 'as-lan' alias resolves to aslan-0.0.4", () => {
    expect(SDK_ALIASES["as-lan"]).toBe("aslan-0.0.4");
  });

  test("Versioned 'as-lan-0.0.4' alias resolves to aslan-0.0.4", () => {
    expect(SDK_ALIASES["as-lan-0.0.4"]).toBe("aslan-0.0.4");
  });
});

describe("resolveSdkId", () => {
  test("Returns the input when it is already a canonical SDK_CONFIGS key", () => {
    expect(resolveSdkId("aslan-0.0.4")).toBe("aslan-0.0.4");
    expect(resolveSdkId("jam-sdk-0.1.26")).toBe("jam-sdk-0.1.26");
  });

  test("Resolves the bare 'as-lan' alias to aslan-0.0.4", () => {
    expect(resolveSdkId("as-lan")).toBe("aslan-0.0.4");
  });

  test("Resolves the versioned 'as-lan-0.0.4' alias to aslan-0.0.4", () => {
    expect(resolveSdkId("as-lan-0.0.4")).toBe("aslan-0.0.4");
  });

  test("Returns undefined for unknown identifiers", () => {
    expect(resolveSdkId("nonsense")).toBeUndefined();
    expect(resolveSdkId("as-lan-0.0.3")).toBeUndefined();
    expect(resolveSdkId("aslan")).toBeUndefined();
  });

  test("Returns undefined for prototype properties (toString, constructor, etc.)", () => {
    expect(resolveSdkId("toString")).toBeUndefined();
    expect(resolveSdkId("constructor")).toBeUndefined();
    expect(resolveSdkId("hasOwnProperty")).toBeUndefined();
  });

  test("Returns undefined for empty string", () => {
    expect(resolveSdkId("")).toBeUndefined();
  });
});

describe("ServiceConfig.sdk type accepts alias strings", () => {
  test("Compiles when sdk is an alias key", () => {
    const cfg: ServiceConfig = {
      path: "./services/example",
      name: "example",
      sdk: "as-lan",
    };
    expect(cfg.sdk).toBe("as-lan");
  });

  test("Compiles when sdk is a versioned alias key", () => {
    const cfg: ServiceConfig = {
      path: "./services/example",
      name: "example",
      sdk: "as-lan-0.0.4",
    };
    expect(cfg.sdk).toBe("as-lan-0.0.4");
  });
});
