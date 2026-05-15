import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { isKnownSdkId, resolveSdk, SDK_CONFIGS } from "./sdk-configs.js";
import type { ServiceConfig } from "./types/config.js";

describe("SDK_CONFIGS wildcard invariants", () => {
  test("Every '<name>@*' entry has '{version}' in its image template", () => {
    for (const [key, entry] of Object.entries(SDK_CONFIGS)) {
      if (key.endsWith("@*")) {
        expect(entry.image).toContain("{version}");
      }
    }
  });

  test("No entry has both a wildcard key and `deprecated: true`", () => {
    for (const [key, entry] of Object.entries(SDK_CONFIGS)) {
      if (key.endsWith("@*")) {
        expect(entry.deprecated).toBeFalsy();
      }
    }
  });
});

describe("resolveSdk - inline SdkConfig", () => {
  test("Returns the inline SdkConfig object unchanged", () => {
    const inline = { image: "custom:1", build: "make", test: "make test" };
    expect(resolveSdk(inline)).toBe(inline);
  });
});

describe("resolveSdk - wildcard substitution", () => {
  test("Substitutes {version} in 'aslan@0.1.0'", () => {
    const result = resolveSdk("aslan@0.1.0");
    expect(result.image).toBe("ghcr.io/tomusdrw/jammin-as-lan:0.1.0");
    expect(result.build).toBe("npm run build");
    expect(result.test).toBe("npm test");
  });

  test("Substitutes {version} in 'as-lan@1.2.3' (separate wildcard entry, same template)", () => {
    const result = resolveSdk("as-lan@1.2.3");
    expect(result.image).toBe("ghcr.io/tomusdrw/jammin-as-lan:1.2.3");
  });

  test("Accepts 'latest' as a literal version string", () => {
    const result = resolveSdk("aslan@latest");
    expect(result.image).toBe("ghcr.io/tomusdrw/jammin-as-lan:latest");
  });

  test("Accepts pre-release version with dot and hyphen", () => {
    const result = resolveSdk("jade@0.1.0-rc.1");
    expect(result.image).toBe("ghcr.io/fluffylabs/jammin-jade:0.1.0-rc.1");
  });

  test("Rewrites `:{version}` to `@{version}` for sha256 digest pins", () => {
    const digest = "1cfc41c23f5c348aaee5f5c70aaa24f10c26baf903de4b4f6774e2032820ba87";
    const result = resolveSdk(`aslan@sha256:${digest}`);
    expect(result.image).toBe(`ghcr.io/tomusdrw/jammin-as-lan@sha256:${digest}`);
  });

  test("Resolves the jambrains wildcard with a sha256 digest", () => {
    const digest = "1cfc41c23f5c348aaee5f5c70aaa24f10c26baf903de4b4f6774e2032820ba87";
    const result = resolveSdk(`jambrains@sha256:${digest}`);
    expect(result.image).toBe(`ghcr.io/jambrains/service-sdk@sha256:${digest}`);
    expect(result.build).toBe("single-file main.c");
  });

  test("Sha pinning works for every wildcard SDK", () => {
    const digest = `sha256:${"a".repeat(64)}`;
    for (const key of Object.keys(SDK_CONFIGS).filter((k) => k.endsWith("@*"))) {
      const name = key.slice(0, -2);
      const result = resolveSdk(`${name}@${digest}`);
      expect(result.image).toContain(`@${digest}`);
      // Tag separator should be gone since the digest replaced it
      expect(result.image).not.toContain(`:${digest}`);
    }
  });

  test("Does not mutate the entry stored in SDK_CONFIGS", () => {
    resolveSdk("aslan@9.9.9");
    expect(SDK_CONFIGS["aslan@*"].image).toBe("ghcr.io/tomusdrw/jammin-as-lan:{version}");
  });

  test("Returned object does not carry the internal `deprecated` flag", () => {
    const result = resolveSdk("aslan@0.1.0") as Record<string, unknown>;
    expect("deprecated" in result).toBe(false);
  });
});

describe("resolveSdk - deprecated exact match", () => {
  let warnSpy: ReturnType<typeof mock>;
  let originalWarn: typeof console.warn;

  beforeEach(() => {
    originalWarn = console.warn;
    warnSpy = mock(() => {});
    console.warn = warnSpy;
    const mod = require("./sdk-configs.js") as { __resetDeprecationWarnings?: () => void };
    mod.__resetDeprecationWarnings?.();
  });

  afterEach(() => {
    console.warn = originalWarn;
  });

  test("Resolves 'aslan-0.0.6' to the dash entry's image", () => {
    const result = resolveSdk("aslan-0.0.6");
    expect(result.image).toBe("ghcr.io/tomusdrw/jammin-as-lan:0.0.6");
    expect(result.build).toBe("npm run build");
  });

  test("Emits a console.warn mentioning the deprecation and a suggested replacement", () => {
    resolveSdk("aslan-0.0.6");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const msg = warnSpy.mock.calls[0]?.[0] as string;
    expect(msg).toContain("aslan-0.0.6");
    expect(msg).toContain("deprecated");
    expect(msg).toContain("0.4.0");
    expect(msg).toContain("aslan@0.0.6");
  });

  test("Deduplicates: same deprecated id warns at most once per process", () => {
    resolveSdk("aslan-0.0.6");
    resolveSdk("aslan-0.0.6");
    resolveSdk("aslan-0.0.6");
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  test("Different deprecated ids each warn once", () => {
    resolveSdk("aslan-0.0.6");
    resolveSdk("jade-0.0.15-pre.1");
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  test("Warns for the jambrains-1cfc41c entry and suggests the full-digest replacement", () => {
    resolveSdk("jambrains-1cfc41c");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const msg = warnSpy.mock.calls[0]?.[0] as string;
    expect(msg).toContain("jambrains-1cfc41c");
    expect(msg).toContain("deprecated");
    expect(msg).toContain("0.4.0");
    // The auto-suggestion (`jambrains@1cfc41c`) would be invalid under the
    // strict sha256 version validator; the entry's explicit `replacement`
    // points at the full-digest form instead.
    expect(msg).toContain("jambrains@sha256:1cfc41c23f5c348aaee5f5c70aaa24f10c26baf903de4b4f6774e2032820ba87");
    expect(msg).not.toMatch(/jambrains@1cfc41c\b/);
  });

  test("Returned object does not carry the internal `deprecated` flag", () => {
    const result = resolveSdk("aslan-0.0.6") as Record<string, unknown>;
    expect("deprecated" in result).toBe(false);
  });
});

describe("resolveSdk - errors", () => {
  test("Throws for a bare framework name with no version", () => {
    expect(() => resolveSdk("aslan")).toThrow("Unknown SDK id: 'aslan'");
  });

  test("Throws for an unknown framework prefix", () => {
    expect(() => resolveSdk("fake@1.0.0")).toThrow("Unknown SDK id: 'fake@1.0.0'");
  });

  test("Throws for a version containing whitespace", () => {
    expect(() => resolveSdk("aslan@bad version")).toThrow("Unknown SDK id: 'aslan@bad version'");
  });

  test("Throws for a version containing a slash", () => {
    expect(() => resolveSdk("aslan@1.0/0")).toThrow("Unknown SDK id: 'aslan@1.0/0'");
  });

  test("Throws for an empty version after '@'", () => {
    expect(() => resolveSdk("aslan@")).toThrow("Unknown SDK id: 'aslan@'");
  });

  test("Throws with the original input for an empty string", () => {
    expect(() => resolveSdk("")).toThrow("Unknown SDK id: ''");
  });

  test("Throws for a literal wildcard key like 'aslan@*'", () => {
    // The wildcard keys are an internal template, not a user-facing id.
    expect(() => resolveSdk("aslan@*")).toThrow("Unknown SDK id: 'aslan@*'");
    expect(() => resolveSdk("jamc3@*")).toThrow("Unknown SDK id: 'jamc3@*'");
  });
});

describe("isKnownSdkId", () => {
  test("Returns true for exact wildcard-substituted ids", () => {
    expect(isKnownSdkId("aslan@0.1.0")).toBe(true);
    expect(isKnownSdkId("aslan@latest")).toBe(true);
    expect(isKnownSdkId("jade@0.0.15-pre.1")).toBe(true);
  });

  test("Returns true for exact deprecated dash keys", () => {
    expect(isKnownSdkId("aslan-0.0.6")).toBe(true);
    expect(isKnownSdkId("jam-sdk-0.1.26")).toBe(true);
    expect(isKnownSdkId("jambrains-1cfc41c")).toBe(true);
  });

  test("Returns true for a full sha256 digest version on any wildcard", () => {
    const digest = "1cfc41c23f5c348aaee5f5c70aaa24f10c26baf903de4b4f6774e2032820ba87";
    expect(isKnownSdkId(`aslan@sha256:${digest}`)).toBe(true);
    expect(isKnownSdkId(`jambrains@sha256:${digest}`)).toBe(true);
  });

  test("Returns false for malformed sha256 versions", () => {
    expect(isKnownSdkId("aslan@sha256:abc")).toBe(false);
    expect(isKnownSdkId("aslan@sha256:")).toBe(false);
    expect(isKnownSdkId("aslan@sha512:0123456789abcdef".padEnd(78, "0"))).toBe(false);
    // Uppercase hex is not accepted - canonical digests are lowercase
    expect(isKnownSdkId(`aslan@sha256:${"A".repeat(64)}`)).toBe(false);
  });

  test("Returns false for unknown ids", () => {
    expect(isKnownSdkId("aslan")).toBe(false);
    expect(isKnownSdkId("fake@1.0.0")).toBe(false);
    expect(isKnownSdkId("aslan@bad version")).toBe(false);
    expect(isKnownSdkId("aslan@")).toBe(false);
    expect(isKnownSdkId("")).toBe(false);
  });

  test("Returns false for literal wildcard keys like 'aslan@*'", () => {
    expect(isKnownSdkId("aslan@*")).toBe(false);
    expect(isKnownSdkId("jamc3@*")).toBe(false);
  });

  test("Returns false for prototype property names", () => {
    expect(isKnownSdkId("toString")).toBe(false);
    expect(isKnownSdkId("constructor")).toBe(false);
    expect(isKnownSdkId("hasOwnProperty")).toBe(false);
  });
});

describe("ServiceConfig.sdk type accepts new wildcard form", () => {
  type Assert<T extends true> = T;
  type _Versioned = Assert<"aslan@0.1.0" extends ServiceConfig["sdk"] ? true : false>;
  type _AsLanVersioned = Assert<"as-lan@1.2.3" extends ServiceConfig["sdk"] ? true : false>;
  type _DeprecatedPinned = Assert<"aslan-0.0.6" extends ServiceConfig["sdk"] ? true : false>;
  type _Jambrains = Assert<"jambrains-1cfc41c" extends ServiceConfig["sdk"] ? true : false>;

  test("Constructs a ServiceConfig literal with wildcard-versioned id", () => {
    const cfg: ServiceConfig = { path: "./svc", name: "svc", sdk: "aslan@0.1.0" };
    expect(cfg.sdk).toBe("aslan@0.1.0");
  });
});
