# Introduction

jammin is Fluffy Labs’ toolchain for building, testing, and operating JAM services on Typeberry networks. The suite spans:

- **jammin cli** for deterministic project bootstrap, builds, deployments, and automated testing.
- **jammin studio** (desktop or IDE extension) that streamlines onboarding and artifact generation for teams that prefer GUI workflows.
- **jammin inspect** for post-deployment observability, block introspection, and interactive refinement scenarios.

Each component speaks the same project configuration format and interoperates with Typeberry primitives (genesis files, node definitions, JAMNP interfaces). Start with the [jammin suite overview](jammin-suite.md) to understand capabilities and roadmap.

## Inspiration Sources

We track the evolution of established smart-contract toolchains to guide jammin’s UX. Two primary references are [Truffle Suite](https://archive.trufflesuite.com/docs/truffle/) and [Hardhat](https://hardhat.org/docs/getting-started). Both ecosystems inform our CLI, testing approach, and agent integrations as we assemble comparable—or improved—developer workflows. Browse the [inspirations section](inspirations.md) for representative structures and sample files from these ecosystems.
