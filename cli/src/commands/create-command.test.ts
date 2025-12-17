import { describe, expect, test } from "bun:test";
import { InvalidArgumentError } from "commander";
import { validate } from "./create-command";

// TODO: [MaSo] Implement accual test for `create` command. This is just and example.
describe("Package validation", () => {
  test("Should pass and trim package names", () => {
    expect(validate("   my-app  ")).toBe("my-app");
    expect(validate("My_app")).toBe("My_app");
    expect(validate("my_app2")).toBe("my_app2");
  });

  test("Should return InvalidArgumentError: empty package name", () => {
    expect(validate("")).toEqual(new InvalidArgumentError("Project name is required"));
  });

  test("Should return InvalidArgumentError: contains illegal character", () => {
    expect(validate("my/illegal.app")).toEqual(
      new InvalidArgumentError(
        "Invalid project name. Project name must start with alpha-numeric value, and can only contains letters, numbers, hyphens, and underscores",
      ),
    );
  });
});
