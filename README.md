# @fluffylabs/jammin

JAM development tooling. Code, build, deploy and test your multi-service projects.

- [Documentation](https://fluffylabs.dev/jammin)

## Documentation

Documentation lives in `docs/` and is powered by [mdBook](https://github.com/rust-lang/mdBook).
To preview locally install `mdbook` (`cargo install mdbook`) and run:

```bash
mdbook serve docs --open
```

## Docker

In `docker` directory exists the `Dockerfile` and an `entrypoint.sh` that packages polkajam and its related binaries in a Linux container.
It creates a minimal Ubuntu-based runtime environment for polkajam.

### `entrypoint.sh` overview

entrypoint.sh acts as a lightweight command router.

At container startup: 1. The first argument passed to the container is read as the desired `polkajam` command 2. Based on that argument, the script executes the corresponding binary: - polkajam - polkajam-testnet - polkajam-repl 3. Any additional arguments are forwarded directly to the selected binary

### command examples

```bash
docker build \
--platform=linux/arm64 \
-t polkajam:v0.1.27-aarch64
```

this command by default uses the:

```
ARG POLKAJAM_TAG=v0.1.27
ARG POLKAJAM_ASSET=polkajam-v0.1.27-linux-aarch64.tgz
```

If one wants different version then one can choose the relevant tag and file from tags and assets at the [polkajam-releases repository of Parity tech](https://github.com/paritytech/polkajam-releases/releases).


### doom-example

This directory contains a docker-composer.yml that shows how doom can run. Unfortunately the final command for "seeing" doom running `corevm-monitor` is not available for linux in the releases (TODO: more investigation is needed for this resolution).


## AI contributors

Automated agents helping on this repository should review `AI_GUIDELINES.md`
before making changes to ensure naming rules—especially the lowercase `jammin`
requirement—are respected.
