# chopsticks example setup

Chopsticks is a Polkadot ecosystem framework for spinning up lightweight forked networks and scripted runtime scenarios. We study it to inform jammin’s approach to deterministic integration tests and live-chain mirroring.

## Directory structure

Chopsticks projects are flexible, but a common layout looks like:

```text
.
├── chopsticks.config.ts
├── scenarios/
│   ├── bootstrap.ts
│   └── ai-workflow.ts
├── fixtures/
│   └── typeberry-state.json
├── scripts/
│   └── seed-balances.ts
├── package.json
└── README.md
```

- `chopsticks.config.ts` describes the base chain to fork, block range, database persistence, and RPC endpoints that scenarios can access.
- `scenarios/` contains executable scripts that mutate chain state, submit extrinsics, or snapshot/rewind blocks.
- `fixtures/` stores JSON snapshots or custom genesis overrides for deterministic replay.
- `scripts/` often wraps CLI commands (e.g., seeding accounts) so workflows stay reproducible.

## Sample config

```ts
import { defineConfig } from "@acala-network/chopsticks";

export default defineConfig({
  chain: "wss://rpc.polkajam.dev",
  block: 12_345_678,
  db: "./.chopsticks/typeberry.db",
  endpoints: {
    typeberry: "ws://127.0.0.1:9944"
  },
  runtimeLog: true,
  scenarios: ["./scenarios/ai-workflow.ts"]
});
```

**scenarios/ai-workflow.ts**

```ts
import { scenario } from "@acala-network/chopsticks";

export default scenario(async ({ api, log }) => {
  const alice = "5Fh...";
  await api.tx.balances.transferKeepAlive(alice, 1_000_000_000).signAndSend(alice);
  log.info("Seeded AI workflow account");
});
```

## Community feedback

- **Positives** – Developers praise Chopsticks for fast forked environments, the ability to script chain state with familiar TypeScript, and seamless access to live-chain storage when reproducing bugs.
- **Trade-offs** – Reviews mention higher resource usage when forking large networks, sparse documentation beyond examples, and occasional drift when upstream runtimes introduce breaking metadata changes.

Key takeaway: jammin’s integration layer should mimic Chopsticks’ “fork-and-script” ergonomics while offering stronger docs, slimmer resource profiles, and tight alignment with Typeberry releases.
