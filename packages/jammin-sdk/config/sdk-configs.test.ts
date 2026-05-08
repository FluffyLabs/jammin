import { describe, expect, test } from "bun:test";
import { resolveSdk, resolveSdkId, SDK_ALIASES, SDK_CONFIGS } from "./sdk-configs.js";
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

  test("Every accepted SDK identifier (canonical or alias) is resolvable", () => {
    const allAcceptedIds = [...Object.keys(SDK_CONFIGS), ...Object.keys(SDK_ALIASES)];
    for (const id of allAcceptedIds) {
      expect(resolveSdkId(id)).toBeDefined();
    }
  });
});

describe("resolveSdk", () => {
  test("Returns SDK_CONFIGS entry for a canonical key", () => {
    const result = resolveSdk("aslan-0.0.4");
    expect(result).toBe(SDK_CONFIGS["aslan-0.0.4"]);
  });

  test("Returns SDK_CONFIGS entry for an alias key", () => {
    const result = resolveSdk("as-lan");
    expect(result).toBe(SDK_CONFIGS["aslan-0.0.4"]);
  });

  test("Returns the inline SdkConfig object unchanged", () => {
    const inline = { image: "custom:1", build: "make", test: "make test" };
    const result = resolveSdk(inline);
    expect(result).toBe(inline);
  });

  test("Throws with a descriptive message for unknown string ids", () => {
    expect(() => resolveSdk("nonsense")).toThrow("Unknown SDK id: 'nonsense'");
  });
});

describe("ServiceConfig.sdk type accepts alias strings", () => {
  type Assert<T extends true> = T;

  // Compile-time assertions: these fail tsc if the union narrows.
  type _AliasAccepted = Assert<"as-lan" extends ServiceConfig["sdk"] ? true : false>;
  type _VersionedAliasAccepted = Assert<"as-lan-0.0.4" extends ServiceConfig["sdk"] ? true : false>;
  type _CanonicalAccepted = Assert<"aslan-0.0.4" extends ServiceConfig["sdk"] ? true : false>;

  test("Constructs a ServiceConfig literal with an alias key", () => {
    const cfg: ServiceConfig = {
      path: "./svc",
      name: "svc",
      sdk: "as-lan",
    };
    expect(cfg.sdk).toBe("as-lan");
  });
});
