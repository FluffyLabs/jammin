# hardhat example project

Hardhat feels more modern than Truffle: TypeScript by default, flexible tasks, big plugin ecosystem. Here’s a trimmed layout from `npx hardhat` plus the files teams usually add.

## directory layout

```text
.
├── contracts/
│   └── WorkRegistry.sol
├── scripts/
│   └── deploy.ts
├── test/
│   └── workRegistry.spec.ts
├── hardhat.config.ts
├── package.json
├── tsconfig.json
└── .env
```

## what lives where

- `contracts/` – Solidity sources; Hardhat writes build artifacts into `artifacts/` and `cache/`.
- `hardhat.config.ts` – main brain. Networks, optimizer, plugins, custom tasks.
- `scripts/` – run via `npx hardhat run scripts/deploy.ts --network ...`.
- `test/` – mocha + chai, usually with ethers.js fixtures and typechain types.
- `.env` – secrets for RPC providers or explorer APIs.

## sample config

```ts
import { HardhatUserConfig } from "hardhat/types";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.21",
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  networks: {
    hardhat: process.env.TYPEBERRY_RPC
      ? { forking: { url: process.env.TYPEBERRY_RPC } }
      : {},
    typeberryDev: {
      url: "http://127.0.0.1:9944",
      accounts: process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : []
    }
  },
  etherscan: { apiKey: process.env.EXPLORER_KEY }
};

export default config;
```

## sample deploy script

```ts
import { ethers } from "hardhat";

async function main() {
  const curator = (await ethers.getSigners())[0];
  const WorkRegistry = await ethers.getContractFactory("WorkRegistry");
  const registry = await WorkRegistry.deploy(curator.address);
  await registry.deployed();
  console.log("Registry deployed to:", registry.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

Lessons for jammin: keep configs in code, make every task scriptable, and provide good TypeScript types for plugins and tests. Also, mainnet forking plus task automation should be first-class features, not bolted on later.
