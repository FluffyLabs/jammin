import { describe, expect, test } from "bun:test";
import { resolveSdkId, SDK_ALIASES, SDK_CONFIGS } from "./sdk-configs.js";

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
});
