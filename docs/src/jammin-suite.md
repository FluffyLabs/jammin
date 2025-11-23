# jammin suite

jammin suite bundles three tools so Typeberry teams can create, ship, and watch services without juggling random scripts. You can pick the tool that fits your flow, but every piece reads the same config files so the hand-off is smooth.

## overview

- **jammin cli** – command runner for init, build, deploy, tests, and quick interactions. Good for automation and CI.
- **jammin studio** – desktop or IDE UI (still in design) for folks who want a guided path but still output the same artifacts.
- **jammin inspect** – web UI that shows what the network is doing and lets you poke services after deploy.

All of them understand Typeberry basics: genesis files, node definitions, service IDs, JAMNP endpoints, and so on.

---

## jammin cli

### project bootstrap

- `jammin init` creates the repo layout, config YAML, starter services, and agent instructions.
- You choose a default SDK plus per-service overrides so mixed stacks still live in one tree.
- Templates cover both simple (single service) and larger multi-service setups.

### builds

- Each service builds inside a Docker image that ships with its SDK. Right now that means JAM SDK, with hooks for others later.
- Custom service types can point to any set of commands; CLI treats them the same as built-in targets.
- Every build outputs a `*.jam` bundle with binaries plus metadata we need for deploys.

### deployment

- CLI turns the bundles into a genesis file and node configs based on the YAML definition (roles, replicas, ports, telemetry flags).
- It launches the nodes, wires bootnodes, and pushes the genesis so everyone starts from the same state.
- Works with a bootstrap service (Polkajam’s or ours) to deploy or upgrade services without restarting the network.
- Includes basic health checks so you notice when a node drops offline or loses peers.

### testing

- **Unit tests**: `jammin test service` spins up Docker for each service and runs the SDK-native command. Exit code decides pass/fail.
- **Integration tests**: jammin provides a harness + SDK that:
  - starts the requested topology,
  - deploys the services,
  - exposes helpers to create work items, push them through refine, package, and accumulation,
  - reads balances or other state to assert behavior.
- Runs should be repeatable, so we either redeploy each time or reset blocks depending on configuration.

### interacting

- Short term we offer a low-level command that takes hex input, submits it, and prints the result. Useful as a sanity check.
- Longer term we want a REPL that knows service codecs (via `@typeberry/codec`) so you can send structured payloads without manual encoding.

---

## jammin studio

- Target options: VS Code extension or Electron app; we are prototyping both.
- Goals:
  - Guide new contributors through project scaffolding and SDK selection.
  - Watch the filesystem so AI helpers can edit code safely.
  - Run builds and spit out `*.jam` bundles, then hand off to the CLI for deploy/test steps.
- Because it uses the same YAML config, teams can hop between Studio and CLI without conversions.

---

## jammin inspect

- Web view (maybe embedded into Studio) that tracks a running Typeberry network.
- Shows:
  - node topology and liveness,
  - blocks as they arrive,
  - per-service state, similar to `state-viewer`,
  - refinement stats so you can see work items move through the pipeline.
- Uses the same type definitions as integration tests, so it can auto-build simple forms that submit or decode work items.

### embedded node approach

- Instead of hitting RPC endpoints directly, inspect prefers an embedded Typeberry node:
  - join the network using the same genesis,
  - stream blocks locally so state stays consistent,
  - expose a tiny WebSocket bridge so the browser can sync blocks (handshake → diff → stream).
- For browser setups we run a “bridge node” in a terminal. It exposes the WebSocket endpoint and feeds the browser copy. Warp-sync can arrive later if replay becomes heavy.

---

## next steps

- Finalize the shared YAML schema so every tool reads the same options.
- Publish the supported Docker images and docs on how to extend them.
- Flesh out the integration testing SDK (fixtures, codecs, helpers).
- Finish the embedded inspector node + WebSocket bridge prototype.
