# Requirements

All jammin tooling expects a recent macOS or Linux environment with the tools below available globally.

## Bun

```bash
# macOS and Linux
curl -fsSL https://bun.sh/install | bash

# Or with Homebrew (macOS)
brew install oven-sh/bun/bun
```

## Docker

```bash
# macOS
brew install --cask docker
open /Applications/Docker.app

# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y docker.io
sudo usermod -aG docker $USER && newgrp docker
```

## Git

```bash
# macOS
brew install git

# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y git
```

Verify each tool with `bun --version`, `docker --version`, and `git --version` before running jammin commands.

## Platform

jammin invokes the SDK build and test containers with `--platform=linux/amd64` by default. Most JAM SDK images today only publish a `linux/amd64` manifest, so on Apple Silicon and other non-amd64 hosts containers run under emulation (slower, but functional).

If an SDK image publishes a different manifest (e.g. `linux/arm64`), override the default by setting `platform` on the `SdkConfig` entry in `packages/jammin-sdk/config/sdk-configs.ts` (or on an inline `SdkConfig` in your `jammin.build.yml`).
