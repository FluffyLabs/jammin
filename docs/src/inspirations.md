# inspirations

jammin borrows tricks from other chains and frameworks. Studying their wins (and pain) keeps us from repeating old mistakes.

- [Truffle reference](truffle-reference.md) shows the classic migrations-first layout.
- [Hardhat reference](hardhat-reference.md) covers the TypeScript-heavy, plugin-friendly world.
- [Chopsticks reference](chopsticks-reference.md) explains the Polkadot fork-and-script workflow.
- [Foundry reference](foundry-reference.md) highlights the fast Rust-style CLI approach for Solidity.
- [Anchor reference](anchor-reference.md) documents the Solana/Rust structure with IDLs and macros.
- [Sui reference](sui-reference.md) shows how Move packages and the `sui` CLI manage builds, tests, and localnets.

## lessons from the field

| Tool | Pros | Cons |
| --- | --- | --- |
| Truffle | ✅ Easy onboarding, built-in migrations, Ganache pairing, lots of tutorials. | 🚫 Slow compile/test cycles, weak TS support, aging deps, fragile migrations on big repos. |
| Hardhat | ✅ TS-first config, rich tasks, good errors, mainnet forking, huge plugin list. | 🚫 Setup can be heavy, plugins drift, flexible structure confuses new folks. |
| Chopsticks | ✅ Fast forked chains, TypeScript scenarios, easy access to live storage. | 🚫 Eats RAM/CPU on large forks, sparse docs, breaks when runtime metadata changes. |
| Foundry | ✅ Blazing `forge test`, fuzzing, Solidity-native scripts. | 🚫 Multiple CLIs to juggle, remapping issues, docs assume Solidity veterans. |
| Anchor | ✅ Rust macros reduce boilerplate, auto IDLs, tight validator integration. | 🚫 Macros hide errors, Solana tooling drifts, TS tests need dependency babysitting. |
| Sui | ✅ Move tests are quick, `sui client` starts localnet fast, manifests keep deps explicit. | 🚫 Move borrow rules are steep, dependency revisions churn, localnet wipes state without snapshots. |

