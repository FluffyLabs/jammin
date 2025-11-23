# foundry example project

Foundry (forge/cast/anvil) is the go-to toolkit for Solidity folks who want fast tests and rust-style CLIs. Here is a small layout pulled from `forge init` with a few extras that show up in day-to-day repos.

## directory layout

```text
.
├── contracts/
│   └── WorkRegistry.sol
├── script/
│   └── Deploy.s.sol
├── test/
│   └── WorkRegistry.t.sol
├── foundry.toml
├── lib/
│   └── forge-std/
├── .env
└── README.md
```

## what lives where

- `contracts/` – Solidity sources.
- `script/` – deployment or maintenance scripts written in Solidity; run via `forge script`.
- `test/` – Solidity tests (or via forge’s ffi mode). `forge-std` helpers live under `lib/`.
- `foundry.toml` – compiler version, optimizer, remappings, RPC endpoints, fuzz settings.

## sample foundry.toml

```toml
[profile.default]
src = "contracts"
out = "out"
libs = ["lib"]
solc_version = "0.8.21"
optimizer = true
optimizer_runs = 200
ffi = true

rpc_endpoints = { typeberryDev = "http://127.0.0.1:9944" }
```

## sample script

```solidity
// script/Deploy.s.sol
pragma solidity 0.8.21;

import "forge-std/Script.sol";
import "../contracts/WorkRegistry.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        WorkRegistry registry = new WorkRegistry(msg.sender);
        console.log("Registry deployed at", address(registry));
        vm.stopBroadcast();
    }
}
```

## takeaways

- Speed: `forge test` is very fast, even with fuzzing.
- Scripts stay close to contracts (Solidity), which keeps logic consistent.
- `.env` + `cast` CLI make it easy to poke live networks.
- Downsides: new users juggle many CLIs (forge/cast/anvil) and remapping errors still bite people. jammin should keep config simple, provide fast tests, and avoid surprise tool juggling.
