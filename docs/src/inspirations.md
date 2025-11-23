# inspirations

jammin borrows tricks from other chains and frameworks. Studying their wins (and pain) keeps us from repeating old mistakes.

- [Truffle reference](truffle-reference.md) shows the classic migrations-first layout.
- [Hardhat reference](hardhat-reference.md) covers the TypeScript-heavy, plugin-friendly world.
- [Chopsticks reference](chopsticks-reference.md) explains the Polkadot fork-and-script workflow.

More pages will show up as we research other stacks like Foundry or Anchor.

## lessons from truffle, hardhat, and chopsticks

- **truffle pros** – simple onboarding, built-in migrations, tight Ganache pairing, lots of tutorials.
- **truffle cons** – slow compile/test loops, weak TypeScript story, dated deps, fragile migrations on bigger projects.
- **hardhat pros** – TS-first config, great error messages, task system, mainnet forking, huge plugin list.
- **hardhat cons** – more setup work, plugins can break between releases, flexible structure confuses new folks.
- **chopsticks pros** – quick forked chains, scenarios in plain TypeScript, easy access to live storage for debugging.
- **chopsticks cons** – heavy resource usage on big forks, light docs, breaks when upstream runtime metadata changes.

Goal for jammin: keep Truffle’s guided flow, borrow Hardhat’s extensibility, and match Chopsticks’ ability to script real networks—while keeping resources and docs under control.
