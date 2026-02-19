import { describe, expect, test } from "bun:test";
import { generateTestConfigCode } from "./generate-test-config.js";

describe("generateTestConfigCode", () => {
  test("generates valid TypeScript for empty service map", () => {
    const code = generateTestConfigCode({});

    // Should parse without throwing
    const transpiler = new Bun.Transpiler({ loader: "ts" });
    expect(() => transpiler.transformSync(code)).not.toThrow();
  });

  test("generates valid TypeScript for single service", () => {
    const code = generateTestConfigCode({
      auth: { id: 0, name: "auth" },
    });

    const transpiler = new Bun.Transpiler({ loader: "ts" });
    expect(() => transpiler.transformSync(code)).not.toThrow();
  });

  test("generates valid TypeScript for multiple services", () => {
    const code = generateTestConfigCode({
      auth: { id: 0, name: "auth" },
      bank: { id: 1, name: "bank" },
      exchange: { id: 2, name: "exchange" },
    });

    const transpiler = new Bun.Transpiler({ loader: "ts" });
    expect(() => transpiler.transformSync(code)).not.toThrow();
  });

  test("includes correct import from SDK package", () => {
    const code = generateTestConfigCode({});

    expect(code).toContain('from "@fluffylabs/jammin-sdk"');
    expect(code).toContain("import { config, ServiceId, TestJam }");
  });

  test("includes SERVICES constant with correct service entries", () => {
    const code = generateTestConfigCode({
      auth: { id: 0, name: "auth" },
      bank: { id: 1, name: "bank" },
    });

    expect(code).toContain("export const SERVICES");
    expect(code).toContain('auth: { id: ServiceId(0), name: "auth" }');
    expect(code).toContain('bank: { id: ServiceId(1), name: "bank" }');
  });

  test("includes TEST_CHAIN_SPEC export", () => {
    const code = generateTestConfigCode({});

    expect(code).toContain("export const TEST_CHAIN_SPEC = config.tinyChainSpec");
  });

  test("includes pre-configured testJam instance", () => {
    const code = generateTestConfigCode({});

    expect(code).toContain("export const testJam = await TestJam.create()");
  });

  test("handles service names with special characters", () => {
    const code = generateTestConfigCode({
      my_service: { id: 42, name: "my_service" },
    });

    const transpiler = new Bun.Transpiler({ loader: "ts" });
    expect(() => transpiler.transformSync(code)).not.toThrow();
    expect(code).toContain('my_service: { id: ServiceId(42), name: "my_service" }');
  });
});
