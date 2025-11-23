# hardhat example project

Hardhat favors flexible task configuration and TypeScript-first tooling. The layout below matches the output of `npx hardhat` (Create an empty hardhat.config) with a sample contract, deployment script, and tests to highlight typical patterns we want jammin to support.

## Directory structure

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

## Key files

- `contracts/` mirrors Truffle but Hardhat leans on incremental compilation and artifacts under `artifacts/` and `cache/`.
- `hardhat.config.ts` defines networks, Solidity settings, plugins, and custom tasks.
- `scripts/` hosts `npx hardhat run` deployment scripts; often paired with `hardhat-deploy`.
- `test/` typically uses mocha/chai plus ethers.js fixtures; TypeScript is common thanks to built-in typechain support.
- `.env` + `hardhat.config.ts` wire secrets into providers; Hardhat encourages mainnet forking for integration tests.

## Sample files

**hardhat.config.ts**

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
    hardhat: {
      forking: process.env.TYPEBERRY_RPC
        ? { url: process.env.TYPEBERRY_RPC }
        : undefined
    },
    typeberryDev: {
      url: "http://127.0.0.1:9944",
      accounts: [process.env.DEPLOYER_KEY!]
    }
  },
  etherscan: {
    apiKey: process.env.EXPLORER_KEY
  }
};

export default config;
```

**scripts/deploy.ts**

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

Hardhat’s emphasis on custom tasks, TypeScript tooling, and network forking reminds us to keep jammin extensible, scriptable, and friendly to rich IDE experiences.
