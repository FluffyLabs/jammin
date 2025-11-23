# chopsticks example setup

Chopsticks lets you fork a Polkadot chain, script it with TypeScript, and replay bugs without heavy infra. It is a good model for jammin’s integration flows.

## directory layout

```text
.
├── chopsticks.config.ts
├── scenarios/
│   ├── bootstrap.ts
│   └── ai-workflow.ts
├── fixtures/typeberry-state.json
├── scripts/seed-balances.ts
├── package.json
└── README.md
```

- `chopsticks.config.ts` – which chain to fork, at which block, and where to store the temp DB.
- `scenarios/` – TypeScript scripts that hit the API, send extrinsics, rewind, or snapshot.
- `fixtures/` – genesis overrides or saved storage dumps.
- `scripts/` – optional helper commands (seeding wallets, etc.).

## sample config

```ts
import { defineConfig } from "@acala-network/chopsticks";

export default defineConfig({
  chain: "wss://rpc.polkajam.dev",
  block: 12_345_678,
  db: "./.chopsticks/typeberry.db",
  endpoints: { typeberry: "ws://127.0.0.1:9944" },
  runtimeLog: true,
  scenarios: ["./scenarios/ai-workflow.ts"]
});
```

## sample scenario

```ts
import { scenario } from "@acala-network/chopsticks";

export default scenario(async ({ api, log }) => {
  const alice = "5Fh...";
  await api.tx.balances
    .transferKeepAlive(alice, 1_000_000_000)
    .signAndSend(alice);
  log.info("Seeded AI workflow account");
});
```

## notes from the field

- **What people like** – quick forked chains, familiar TypeScript, easy way to tweak chain state or run scripts as if they were live.
- **Rough edges** – eats RAM/CPU on large forks, docs are thin outside of examples, runtime metadata changes upstream can break older scenarios.

jammin should copy the good parts (fast forks, simple scripts) but keep resources in check and document breaking changes clearly.
