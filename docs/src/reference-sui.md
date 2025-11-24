# sui example project

Sui projects use Move packages plus the `sui` CLI for builds, tests, and localnet work. This snapshot shows what you get after `sui move new` plus a few files teams add right away.

## directory layout

```text
.
├── Move.toml
├── sources/
│   └── work_registry.move
├── tests/
│   └── work_registry_tests.move
├── scripts/
│   └── publish.sh
├── sui.client.yaml
└── README.md
```

## what lives where

- `Move.toml` – package manifest listing named addresses, dependencies, build profile.
- `sources/` – Move modules.
- `tests/` – Move unit tests (run with `sui move test`).
- `scripts/` – helper shell/JS files to publish packages or call entry functions via `sui client`.
- `sui.client.yaml` – CLI profile (RPC endpoints, active address, keystore path).

## sample Move.toml

```toml
[package]
name = "work_registry"
version = "0.0.1"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "mainnet" }

[addresses]
work_registry = "0x0"
```

## sample module

```rust
module work_registry::work {
    use sui::transfer;
    struct Work has key {
        id: UID,
        owner: address,
        payload: vector<u8>,
    }

    public entry fun register(ctx: &mut TxContext, payload: vector<u8>) {
        let work = Work {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            payload,
        };
        transfer::share_object(work);
    }
}
```

## notes

- **Pros** – strong object model, `sui client` can spin up a localnet quickly, Move unit tests run fast, CLI profiles keep RPC/auth tidy.
- **Cons** – Move borrow rules trip up newcomers, dependency pins drift often, localnet resets wipe state, and tooling is still moving fast.

Design hint for jammin: keep manifests simple, make local devnets one command away, and document breaking runtime changes so SDKs do not drift.
