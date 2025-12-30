# Introduction

jammin is Fluffy Labs’ toolbox for JAM service builders. You can use it to spin up a project, build services, ship them to a network, and keep an eye on what happens after deploy.

- **jammin cli** starts projects, builds services, deploys testnets, and runs tests. Works well in scripts and CI.
- **jammin studio** will be a desktop or IDE front-end for folks who prefer clicks over shells.
- **jammin inspect** shows what the network is doing and lets you poke deployed services.

All tools read the same YAML config, so you can swap between them without conversion work. Check the [jammin suite overview](bootstrap/jammin-suite.md) for the long version.

## Inspiration sources

We pay close attention to existing smart-contract stacks such as [Truffle Suite](https://archive.trufflesuite.com/docs/truffle/) and [Hardhat](https://hardhat.org/docs/getting-started), plus Polkadot tooling like [Chopsticks](https://github.com/AcalaNetwork/chopsticks). These projects already solved many problems we care about. The [inspirations section](inspirations.md) collects sample layouts, configs, and notes on what works well (and what doesn’t).

## Resources

- [FluffyLabs Jammin Github](https://github.com/FluffyLabs/jammin)
- [npm package](https://www.npmjs.com/package/@fluffylabs/jammin)
