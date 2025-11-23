# inspirations

jammin borrows tricks from other chains and frameworks. Studying their wins (and pain) keeps us from repeating old mistakes.

- [Truffle reference](truffle-reference.md) shows the classic migrations-first layout.
- [Hardhat reference](hardhat-reference.md) covers the TypeScript-heavy, plugin-friendly world.
- [Chopsticks reference](chopsticks-reference.md) explains the Polkadot fork-and-script workflow.
- [Foundry reference](foundry-reference.md) highlights the fast Rust-style CLI approach for Solidity.
- [Anchor reference](anchor-reference.md) documents the Solana/Rust structure with IDLs and macros.
- [Sui reference](sui-reference.md) shows how Move packages and the `sui` CLI manage builds, tests, and localnets.

More pages will show up as we research other stacks like Foundry or Anchor.

## lessons from truffle, hardhat, and chopsticks

- **truffle pros** – simple onboarding, built-in migrations, tight Ganache pairing, lots of tutorials.
- **truffle cons** – slow compile/test loops, weak TypeScript story, dated deps, fragile migrations on bigger projects.
- **hardhat pros** – TS-first config, great error messages, task system, mainnet forking, huge plugin list.
- **hardhat cons** – more setup work, plugins can break between releases, flexible structure confuses new folks.
- **chopsticks pros** – quick forked chains, scenarios in plain TypeScript, easy access to live storage for debugging.
- **chopsticks cons** – heavy resource usage on big forks, light docs, breaks when upstream runtime metadata changes.

- **foundry pros** – blazing `forge test` speed, Solidity-based scripts, good fuzzing and cheatcodes.
- **foundry cons** – multiple CLI tools confuse newcomers, remapping errors are common, docs expect Solidity veterans.
- **anchor pros** – tight Rust macros, auto-generated IDLs, batteries-included testing with `solana-test-validator`.
- **anchor cons** – macro magic hides errors, Solana tooling can be brittle across releases, TS tests need frequent dependency babysitting.
- **sui pros** – Move unit tests are fast, localnet spins up with one CLI command, manifests keep dependencies explicit.
- **sui cons** – Move borrow checker has a steep learning curve, dependency revisions churn, localnet resets wipe state unless you snapshot.

Goal for jammin: keep Truffle’s guided flow, borrow Hardhat’s extensibility, adopt Chopsticks-style scripting, and provide Foundry/Anchor/Sui-level speed plus clean manifests—without drowning people in toolchains.
