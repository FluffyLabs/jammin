import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { resolve } from "node:path";
import type { SdkConfig, ServiceConfig } from "../../types/config";
import { ConfigError } from "../../types/errors";
import { SDK_CONFIGS } from "../../utils/sdk-configs";
import { buildService } from "./build-command";

describe("build-command", () => {
  describe("buildService - Docker command generation", () => {
    let originalSpawn: typeof Bun.spawn;
    let mockSpawn: ReturnType<typeof mock>;

    beforeEach(() => {
      originalSpawn = Bun.spawn;
      mockSpawn = mock(() => {
        return {
          stdout: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode("build output"));
              controller.close();
            },
          }),
          stderr: new ReadableStream({
            start(controller) {
              controller.close();
            },
          }),
          exited: Promise.resolve(0),
        };
      });
      // biome-ignore lint/suspicious/noExplicitAny: Need to mock Bun.spawn for testing
      (Bun as any).spawn = mockSpawn;
    });

    afterEach(() => {
      Bun.spawn = originalSpawn;
    });

    test("should generate correct Docker command for predefined SDK (jambrains)", async () => {
      const service: ServiceConfig = {
        name: "test-service",
        path: "./services/test",
        sdk: "jambrains",
      };

      await buildService(service, "/test/project");

      expect(mockSpawn).toHaveBeenCalledTimes(1);
      const spawnCall = mockSpawn.mock.calls[0];
      if (!spawnCall) {
        throw new Error("spawnCall is undefined");
      }
      expect(spawnCall[0]).toEqual(["sh", "-c", expect.stringContaining("docker")]);

      const dockerCommand = spawnCall[0][2] as string;
      expect(dockerCommand).toContain("docker run --rm -v");
      expect(dockerCommand).toContain(`${resolve("/test/project", "./services/test")}:/app`);
      expect(dockerCommand).toContain(SDK_CONFIGS.jambrains.image);
      expect(dockerCommand).toContain(SDK_CONFIGS.jambrains.build);
    });

    test("should generate correct Docker command for predefined SDK (jade)", async () => {
      const service: ServiceConfig = {
        name: "jade-service",
        path: "./jade",
        sdk: "jade-0.0.15-pre.1",
      };

      await buildService(service, "/test/project");

      expect(mockSpawn).toHaveBeenCalledTimes(1);
      const spawnCall = mockSpawn.mock.calls[0];
      if (!spawnCall) {
        throw new Error("spawnCall is undefined");
      }
      const dockerCommand = spawnCall[0][2] as string;

      expect(dockerCommand).toContain(SDK_CONFIGS["jade-0.0.15-pre.1"].image);
      expect(dockerCommand).toContain(SDK_CONFIGS["jade-0.0.15-pre.1"].build);
      expect(dockerCommand).toContain(`${resolve("/test/project", "./jade")}:/app`);
    });

    test("should generate correct Docker command for custom SDK config", async () => {
      const customSdk: SdkConfig = {
        image: "custom-image:latest",
        build: "custom build command with args",
        test: "custom test",
      };

      const service: ServiceConfig = {
        name: "custom-service",
        path: "./custom",
        sdk: customSdk,
      };

      await buildService(service, "/test/project");

      expect(mockSpawn).toHaveBeenCalledTimes(1);
      const spawnCall = mockSpawn.mock.calls[0];
      if (!spawnCall) {
        throw new Error("spawnCall is undefined");
      }
      const dockerCommand = spawnCall[0][2] as string;

      expect(dockerCommand).toContain("custom-image:latest");
      expect(dockerCommand).toContain("custom build command with args");
      expect(dockerCommand).toContain(`${resolve("/test/project", "./custom")}:/app`);
    });

    test("should handle build failure with non-zero exit code", async () => {
      const mockFailedSpawn = mock(() => {
        return {
          stdout: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode("build error output"));
              controller.close();
            },
          }),
          stderr: new ReadableStream({
            start(controller) {
              controller.close();
            },
          }),
          exited: Promise.resolve(1),
        };
      });

      // biome-ignore lint/suspicious/noExplicitAny: Need to mock Bun.spawn for testing
      (Bun as any).spawn = mockFailedSpawn;

      const service: ServiceConfig = {
        name: "failing-service",
        path: "./fail",
        sdk: "jambrains",
      };

      await expect(buildService(service, "/test/project")).rejects.toThrow();
      await expect(buildService(service, "/test/project")).rejects.toThrow(
        "Build failed for service 'failing-service'",
      );
    });

    test("should return build output on success", async () => {
      const expectedOutput = "build successful output";
      const mockSuccessSpawn = mock(() => {
        return {
          stdout: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(expectedOutput));
              controller.close();
            },
          }),
          stderr: new ReadableStream({
            start(controller) {
              controller.close();
            },
          }),
          exited: Promise.resolve(0),
        };
      });

      // biome-ignore lint/suspicious/noExplicitAny: Need to mock Bun.spawn for testing
      (Bun as any).spawn = mockSuccessSpawn;

      const service: ServiceConfig = {
        name: "success-service",
        path: "./success",
        sdk: "jambrains",
      };

      const output = await buildService(service, "/test/project");
      expect(output).toBe(expectedOutput);
    });
  });

  describe("buildService - service path resolution", () => {
    let originalSpawn: typeof Bun.spawn;

    beforeEach(() => {
      originalSpawn = Bun.spawn;
    });

    afterEach(() => {
      Bun.spawn = originalSpawn;
    });

    test("should resolve relative service paths correctly", async () => {
      const mockSpawn = mock(() => {
        return {
          stdout: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode("build output"));
              controller.close();
            },
          }),
          stderr: new ReadableStream({
            start(controller) {
              controller.close();
            },
          }),
          exited: Promise.resolve(0),
        };
      });

      // biome-ignore lint/suspicious/noExplicitAny: Need to mock Bun.spawn for testing
      (Bun as any).spawn = mockSpawn;

      const service: ServiceConfig = {
        name: "test-service",
        path: "./services/test",
        sdk: "jambrains",
      };

      const projectRoot = "/absolute/project/root";
      await buildService(service, projectRoot);

      expect(mockSpawn).toHaveBeenCalledTimes(1);
      expect(mockSpawn.mock.calls.length).toBeGreaterThan(0);
      const spawnCall = mockSpawn.mock.calls[0];
      if (!spawnCall || spawnCall.length === 0) {
        throw new Error("spawnCall is undefined or empty");
      }
      const spawnArgs = (spawnCall as unknown[])[0] as string[];
      if (!spawnArgs || spawnArgs.length < 3) {
        throw new Error("spawnArgs is invalid");
      }
      const dockerCommand = spawnArgs[2] as string;
      const expectedPath = resolve(projectRoot, service.path);

      expect(dockerCommand).toContain(`${expectedPath}:/app`);
    });
  });
});
