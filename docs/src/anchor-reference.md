# anchor example project

Anchor is the Rust-based framework most Solana teams use. Its structure helps us think about how jammin should mix declarative accounts, IDLs, and scripting.

## directory layout

```text
.
├── programs/
│   └── work-registry/
│       ├── Cargo.toml
│       └── src/lib.rs
├── tests/
│   └── work-registry.ts
├── Anchor.toml
├── Cargo.toml
├── tsconfig.json
└── package.json
```

## what lives where

- `programs/<name>/` – Rust crate for the on-chain program.
- `tests/` – TypeScript tests that use Anchor’s client plus mocha.
- `Anchor.toml` – cluster RPC URLs, program IDs, workspace config.
- Root `Cargo.toml` wires all programs together.

## sample Anchor.toml

```toml
[programs.localnet]
work_registry = "WorkReg1stry111111111111111111111111111111"

[provider]
cluster = "Localnet"
wallet = "~/.config/solana/id.json"

[scripts]
test = "npm run test"
```

## sample rust entry

```rust
use anchor_lang::prelude::*;

declare_id!("WorkReg1stry111111111111111111111111111111");

#[program]
pub mod work_registry {
    use super::*;

    pub fn register_work(ctx: Context<RegisterWork>, payload: Vec<u8>) -> Result<()> {
        let account = &mut ctx.accounts.work;
        account.owner = ctx.accounts.owner.key();
        account.payload = payload;
        Ok(())
    }
}
```

## notes

- Anchor’s macros keep boilerplate low but require you to stick to its patterns.
- Tests run against `solana-test-validator`, often spin up quickly but can be flaky when IDs drift.
- IDL generation is automatic, which downstream clients love.
- For jammin: aim for strong IDL/codegen, keep tests close to the runtime, and lean on scripts for repeatable deployments.
