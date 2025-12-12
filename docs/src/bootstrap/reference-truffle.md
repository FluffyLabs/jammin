# truffle example project

Truffle still shows up in a lot of audits and legacy repos, so it’s a useful baseline. This is what you usually get right after `truffle init`, plus a couple of files teams add in real life.

## directory layout

```text
.
├── contracts/
│   ├── Migrations.sol
│   └── WorkRegistry.sol
├── migrations/
│   ├── 1_initial_migration.js
│   └── 2_deploy_work_registry.js
├── test/
│   ├── workRegistry.test.js
│   └── helpers/time.js
├── scripts/
│   └── mint-work-items.js
├── truffle-config.js
├── package.json
└── README.md
```

## what lives where

- `contracts/` – Solidity sources. `Migrations.sol` is required; `WorkRegistry.sol` stands in for your real code.
- `migrations/` – numbered JS files that deploy contracts one after another.
- `scripts/` – ad-hoc helpers (seed accounts, mint tokens).
- `test/` – mocha tests in JS/TS, sometimes helpers in subfolders.
- `truffle-config.js` – networks, compilers, plugins.

## sample config

```js
require("dotenv").config();
const { HDWalletProvider } = require("@truffle/hdwallet-provider");

module.exports = {
  networks: {
    development: { host: "127.0.0.1", port: 8545, network_id: "*" },
    typeberryDev: {
      provider: () =>
        new HDWalletProvider(process.env.DEPLOYER_KEY, "http://127.0.0.1:9944"),
      network_id: 42,
      skipDryRun: true
    }
  },
  compilers: {
    solc: {
      version: "0.8.21",
      settings: { optimizer: { enabled: true, runs: 200 } }
    }
  },
  plugins: ["truffle-plugin-verify"]
};
```

## sample migration

```js
const WorkRegistry = artifacts.require("WorkRegistry");

module.exports = async function (deployer, network, accounts) {
  const curator = accounts[0];
  await deployer.deploy(WorkRegistry, curator);
  const registry = await WorkRegistry.deployed();
  console.log(`Registry deployed on ${network} at ${registry.address}`);
};
```

Takeaways for jammin: migrations need to be simple, config must live in version control, and we should leave hook points for scripts/plugins instead of forcing hand-written glue.
