# jammin suite

The jammin suite is Fluffy Labs' end‑to‑end tooling stack for building, testing, and operating services on typeberry networks. It packages everything required to bootstrap a project, compile and distribute services, launch dedicated testnets, and inspect live deployments. The suite currently consists of three products — `jammin cli`, `jammin studio`, and `jammin inspect` — that can be adopted independently or as a cohesive workflow.

## Architectural Overview

1. **jammin cli** orchestrates project bootstrap, SDK configuration, service builds, testnet deployment, and automated testing pipelines. It is optimized for power users who want deterministic, scriptable control.
2. **jammin studio** provides an onboarding experience (Electron app or VS Code extension) so new teams can create JAM projects, iterate on code, and hand off artifacts to the CLI without touching the terminal.
3. **jammin inspect** focuses on post‑deployment operations. It monitors network health, exposes service state, decodes blocks, and offers an interaction surface for refinement workflows.

Each component speaks typeberry primitives (genesis files, node definitions, refinement workflows, JAMNP interfaces) to ensure smooth handoffs across the build → deploy → operate lifecycle.

---

## jammin cli

### Project Bootstrap

- Initializes a new JAM workspace from a template library.
- Prompts for a default JAM SDK and allows per‑service overrides so heterogeneous stacks (e.g., JAM SDK today, JADE tomorrow) share a single project file.
- Generates a YAML configuration that captures SDK selections, service targets, and deployment metadata. This file is the single source of truth that both Studio and Inspector consume.

### Build Pipeline

1. **Service‑aware builds** – Each service is compiled using its SDK‑specific toolchain. We ship Docker images for officially supported SDKs (initially JAM SDK, later JADE and others) to keep environments reproducible.
2. **Custom service types** – Projects can define bespoke service descriptors that list arbitrary build commands; the CLI treats them as first‑class targets.
3. **Artifacts** – Every build produces a `*.jam` bundle that contains the compiled service artifacts and metadata required for deployment.

### Deployment Orchestration

1. **Genesis authoring**
   - Built services are embedded into a genesis specification so new nodes start with a consistent state.
2. **Bootstrap service integration**
   - Works with Polkajam’s bootstrap service or jammin’s own implementation to deploy services into an existing network via a `new`‑style API.
3. **Testnet definitions**
   - YAML describes node roles, instance counts, and parameter mappings (networking, RPC ports, telemetry, etc.).
   - The CLI expands these definitions into runnable node processes, wires bootnodes, and distributes the genesis file.
   - Initial focus is typeberry nodes, but the format leaves room for additional chains.
4. **Upgradable services**
   - Instead of re‑seeding a network, teams can upgrade in‑place by supplying new `*.jam` bundles. The CLI handles compatibility checks and upgrade sequencing.

### Testing Support

1. **Unit (service) tests**
   - The CLI exposes a `jam test service` command that dispatches to SDK‑native test runners. We treat exit codes as the contract—implementation details remain within the SDK.
2. **Integration (project) tests**
   - Provides a deterministic test harness that spins up the target topology, deploys services, and exposes an SDK for scripted interactions.
   - Example workflow: create multiple work items, push them through refinement, package results, send for accumulation, and assert state transitions.

### Interactive Mode

- Mirrors integration testing but keeps the environment live so operators can issue ad‑hoc actions.
- Ships (or plugs into) a REPL/SDK bridge that can encode service inputs. Until we converge on a unified schema registry, users describe payload shapes using the same codec hints as their service SDKs (currently `@typeberry/codec`).

---

## jammin studio

- Delivered either as an Electron desktop client or a VS Code extension.
- Targets developers who prefer GUI workflows while still producing CLI‑ready assets.
- Capabilities:
  1. Project scaffolding, including SDK selection and service definitions, stored in the standard YAML format.
  2. File system monitoring so AI coding assistants can propose or apply code changes safely.
  3. Build management up to the point of producing `*.jam` artifacts. Deployment, testnet orchestration, and runtime management remain the CLI’s responsibility.
- Studio and CLI share the same project metadata, so teams can start in Studio, then switch to CLI automation without translation steps.

---

## jammin inspect

jammin inspect is the observability and interaction surface for deployed typeberry networks. It can be embedded into Studio (for the Electron flavor) or delivered as a standalone web application.

### Post‑Deployment Insights

1. **Network view** – Displays node topology, role assignments, and liveness. Pulls from telemetry or configuration when RPC access is unavailable.
2. **Service state inspection** – Offers state viewers similar to `state-viewer`, letting operators drill into per‑service data.
3. **Block stream analysis** – Shows incoming blocks, work packages, and refinement activity. Operators can trace how work items progress through the pipeline.
4. **Refinement introspection** – Either integrates with `jamtop` or provides a streamlined view of refinement stages and metrics.

### Interaction Layer

- Builds reusable UI components from the same input/output schemas used by services. With AI assistance, users can assemble dashboards that:
  - Submit work items with structured payloads.
  - Trace refinement progress and accumulated results.
  - Trigger upgrades or maintenance routines when paired with the CLI.

### Embedded Node Strategy

- Whenever possible, Inspector runs against an embedded typeberry node rather than raw RPC endpoints. This node:
  1. Joins the target network using the provided genesis file.
  2. Streams blocks locally so Inspector can derive state without trusting remote RPC.
  3. Supplies a minimal WebSocket interface that browsers can consume. The interface loosely mirrors JAMNP handlers:
     - Performs a handshake that validates the genesis hash.
     - Syncs block gaps between the bridge node (terminal process) and the browser node.
     - Streams blocks until both nodes share the same state. Future iterations can add warp‑sync to reduce CPU load on the browser.
- For web deployments, operators run a lightweight “bridge node” in a terminal. It exposes the above WebSocket endpoint and forwards blocks to the browser. Small testnets can afford full block replay; production deployments can opt into warp‑sync once available.

---

## Next Steps

- Finalize the project YAML schema so all three products speak the same configuration language.
- Publish official Docker images for supported SDKs and document how to extend them for custom services.
- Define the integration testing SDK surface (fixtures, assertions, codecs) so teams can adopt it incrementally.
- Prototype the embedded Inspector node with a simple WebSocket bridge to validate the synchronization model.
