# @fluffylabs/jammin

JAM development tooling. Code, build, deploy and test your multi-service projects.

- [Documentation](https://fluffylabs.dev/jammin)

## Documentation

Documentation lives in `docs/` and is powered by [mdBook](https://github.com/rust-lang/mdBook).
To preview locally install `mdbook` (`cargo install mdbook`) and run:

```bash
mdbook serve docs --open
```

## Dockers

The `docker/` directory contains multiple build contexts for the supported runtimes:

- `docker/polkajam/polkajam.Dockerfile` creates a minimal Ubuntu-based runtime for polkajam.
- `docker/jade/jade.Dockerfile` provides a Rust toolchain image with `rust-src` for jade development.
- `docker/jam-sdk/jam-sdk.Dockerfile` installs the `jam-pvm-build` tool used by the jam SDK pipelines.

### polkajam

The polkajam image also includes an `entrypoint.sh` that packages polkajam and its related binaries in a Linux container, wiring them through a lightweight command router.
It creates a minimal Ubuntu-based runtime environment for polkajam.

#### `entrypoint.sh` overview

entrypoint.sh acts as a lightweight command router.

At container startup: 1. The first argument passed to the container is read as the desired `polkajam` command 2. Based on that argument, the script executes the corresponding binary: - polkajam - polkajam-testnet - polkajam-repl 3. Any additional arguments are forwarded directly to the selected binary

#### command examples

```bash
docker build -t polkajam:v0.1.27 .
```

this command by default uses the:

```
ARG POLKAJAM_TAG=v0.1.27
ARG POLKAJAM_ASSET=polkajam-v0.1.27-linux-aarch64.tgz
```

If one wants different version then one can choose the relevant tag and file from tags and assets at the [polkajam-releases repository of Parity tech](https://github.com/paritytech/polkajam-releases/releases).

Running:

```bash
docker compose up
```

in the same directory (`/docker`) you will see the polkajam-testnet running

## AI contributors

Automated agents helping on this repository should review `AI_GUIDELINES.md`
before making changes to ensure naming rules—especially the lowercase `jammin`
requirement—are respected.
