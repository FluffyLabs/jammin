# inspirations

jammin borrows the best practices from established smart-contract frameworks so we avoid reinventing battle-tested ergonomics. This section groups reference material for popular toolchains we study before designing new UX flows or CLIs.

- [Truffle reference](truffle-reference.md) highlights the default project structure, migrations, and config conventions that make onboarding friendly.
- [Hardhat reference](hardhat-reference.md) showcases the TypeScript-first experience, custom tasks, and plugin ecosystem that power advanced teams.
- [Chopsticks reference](chopsticks-reference.md) captures the Polkadot ecosystem’s fork-and-script workflow for deterministic integration testing.

We will expand this section with additional ecosystems (e.g., Foundry, Anchor) as we gather more comparative research.

## lessons from truffle, hardhat & chopsticks

Community feedback about incumbent frameworks helps shape jammin’s priorities:

- **truffle positives** – Integrated migrations, Ganache pairing, and straightforward testing make onboarding gentle for small teams. Rich tutorials and opinionated structure reduce bikeshedding for first deployments.
- **truffle limitations** – Users report slower compile/test cycles, limited TypeScript support, and aging dependency chains. Plugin surface is narrower than newer stacks, and large projects often hit migration bottlenecks or outgrow the default build pipeline.
- **hardhat positives** – Modern DX with TypeScript-first config, granular tasks, console, and mainnet forking receives strong praise. A wide plugin ecosystem (ethers, deploy, gas-reporter, etc.) plus clear error stacks accelerates iteration.
- **hardhat trade-offs** – Reviews highlight steeper initial setup, heavy reliance on community plugins that can break between versions, and more responsibility placed on teams to define structure. The flexibility can overwhelm newcomers compared to turnkey suites.
- **chopsticks positives** – Rapid forked networks, scriptable TypeScript scenarios, and direct access to live-chain storage make reproducing Polkadot bugs much easier.
- **chopsticks limitations** – Heavy resource usage on large forks, thin documentation, and occasional breakage when runtimes update metadata force teams to babysit upgrades.

jammin should blend truffle’s guided flows with hardhat’s extensibility while adopting chopsticks-style forking ergonomics: offer opinionated defaults, modular building blocks, and predictable scripted environments that track Typeberry releases closely.
