import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdir, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("start-command", () => {
  describe("createFilteredGenesis", () => {
    const { createFilteredGenesis } = require("./start-command");

    test("filters out genesis state drop keys from genesis data", async () => {
      const genesisWithState = {
        network: "testnet",
        genesis_state: {
          "04000000000000000000000000000000000000000000000000000000000000": { data: "next" },
          "07000000000000000000000000000000000000000000000000000000000000": { data: "designated" },
          "08000000000000000000000000000000000000000000000000000000000000": { data: "current" },
          "09000000000000000000000000000000000000000000000000000000000000": { data: "previous" },
          "05000000000000000000000000000000000000000000000000000000000000": { data: "keep this" },
        },
      };

      const tmpGenesisPath = join(tmpdir(), `test-genesis-${Date.now()}.json`);
      await Bun.write(tmpGenesisPath, JSON.stringify(genesisWithState));

      const resultPath = await createFilteredGenesis(tmpGenesisPath);
      const result = await Bun.file(resultPath).json();

      expect(result.genesis_state).toBeDefined();
      expect(result.genesis_state["04000000000000000000000000000000000000000000000000000000000000"]).toBeUndefined();
      expect(result.genesis_state["07000000000000000000000000000000000000000000000000000000000000"]).toBeUndefined();
      expect(result.genesis_state["08000000000000000000000000000000000000000000000000000000000000"]).toBeUndefined();
      expect(result.genesis_state["09000000000000000000000000000000000000000000000000000000000000"]).toBeUndefined();
      expect(result.genesis_state["05000000000000000000000000000000000000000000000000000000000000"]).toEqual({
        data: "keep this",
      });

      await unlink(tmpGenesisPath).catch(() => {});
      await unlink(resultPath).catch(() => {});
    });

    test("handles genesis without genesis_state field", async () => {
      const genesisWithoutState = {
        network: "testnet",
        config: { chainId: 1 },
      };

      const tmpGenesisPath = join(tmpdir(), `test-genesis-${Date.now()}.json`);
      await Bun.write(tmpGenesisPath, JSON.stringify(genesisWithoutState));

      const resultPath = await createFilteredGenesis(tmpGenesisPath);
      const result = await Bun.file(resultPath).json();

      expect(result.network).toBe("testnet");
      expect(result.config).toEqual({ chainId: 1 });
      expect(result.genesis_state).toBeUndefined();

      await unlink(tmpGenesisPath).catch(() => {});
      await unlink(resultPath).catch(() => {});
    });

    test("writes filtered genesis to temp directory", async () => {
      const genesis = { genesis_state: {} };

      const tmpGenesisPath = join(tmpdir(), `test-genesis-${Date.now()}.json`);
      await Bun.write(tmpGenesisPath, JSON.stringify(genesis));

      const resultPath = await createFilteredGenesis(tmpGenesisPath);

      expect(resultPath).toContain("jammin-genesis-");
      expect(resultPath).toContain(tmpdir());

      await unlink(tmpGenesisPath).catch(() => {});
      await unlink(resultPath).catch(() => {});
    });
  });

  describe("pullImage", () => {
    let originalSpawn: typeof Bun.spawn;
    let mockSpawn: ReturnType<typeof mock>;

    beforeEach(() => {
      originalSpawn = Bun.spawn;
      mockSpawn = mock(() => ({
        stdout: new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
        stderr: new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
        exited: Promise.resolve(0),
      }));
      // biome-ignore lint/suspicious/noExplicitAny: Need to mock Bun.spawn for testing
      (Bun as any).spawn = mockSpawn;
    });

    afterEach(() => {
      Bun.spawn = originalSpawn;
    });

    test("pulls the correct Docker image with platform flag", async () => {
      const { pullImage } = require("./start-command");
      await pullImage();

      expect(mockSpawn).toHaveBeenCalledTimes(1);
      const callArgs = mockSpawn.mock.calls[0];
      expect(callArgs?.[0]).toEqual([
        "docker",
        "pull",
        "--platform=linux/amd64",
        "ghcr.io/fluffylabs/typeberry:latest",
      ]);
    });

    test("throws error when pull fails with non-zero exit code", async () => {
      const failingMockSpawn = mock(() => ({
        stdout: new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
        stderr: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("pull failed: network error"));
            controller.close();
          },
        }),
        exited: Promise.resolve(1),
      }));
      // biome-ignore lint/suspicious/noExplicitAny: Need to mock Bun.spawn for testing
      (Bun as any).spawn = failingMockSpawn;

      const { pullImage } = require("./start-command");

      return Promise.all([
        expect(pullImage()).rejects.toThrow("Failed to pull image"),
        expect(pullImage()).rejects.toThrow("exit code 1"),
      ]);
    });
  });

  describe("startContainer", () => {
    let originalSpawn: typeof Bun.spawn;
    let originalCwd: () => string;
    let mockSpawn: ReturnType<typeof mock>;
    let testCwd: string;

    beforeEach(async () => {
      originalSpawn = Bun.spawn;
      mockSpawn = mock(() => ({
        stdout: new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
        stderr: new ReadableStream({
          start(controller) {
            controller.close();
          },
        }),
        exited: Promise.resolve(0),
      }));
      // biome-ignore lint/suspicious/noExplicitAny: Need to mock Bun.spawn for testing
      (Bun as any).spawn = mockSpawn;

      testCwd = join(tmpdir(), `jammin-test-${Date.now()}`);
      await mkdir(testCwd, { recursive: true });
      await mkdir(join(testCwd, "logs"), { recursive: true });
      originalCwd = process.cwd;
      process.cwd = mock(() => testCwd);
    });

    afterEach(async () => {
      Bun.spawn = originalSpawn;
      process.cwd = originalCwd;
      await rm(testCwd, { recursive: true }).catch(() => {});
    });

    test("spawns docker container with correct arguments in correct order", async () => {
      const { startContainer } = require("./start-command");

      await startContainer("/tmp/filtered-genesis.json");

      expect(mockSpawn).toHaveBeenCalledTimes(1);
      const callArgs = mockSpawn.mock.calls[0];
      const dockerArgs = callArgs?.[0] as string[];

      expect(dockerArgs).toEqual([
        "docker",
        "run",
        "--rm",
        "-v",
        "/tmp/filtered-genesis.json:/app/genesis.json:ro",
        "-v",
        `${testCwd}/logs:/app/bin/jam/logs`,
        "--entrypoint",
        "/bin/bash",
        "ghcr.io/fluffylabs/typeberry:latest",
        "-c",
        "npm run tiny-network -- --config=dev --config=.chain_spec+=/app/genesis.json",
      ]);
    });

    test("passes cwd to docker spawn", async () => {
      const { startContainer } = require("./start-command");

      await startContainer("/tmp/filtered-genesis.json");

      expect(mockSpawn).toHaveBeenCalledTimes(1);
      const callArgs = mockSpawn.mock.calls[0];
      expect(callArgs?.[1]?.cwd).toBe(testCwd);
    });
  });
});
