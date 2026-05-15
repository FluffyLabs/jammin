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

jammin always invokes the SDK build and test containers with `--platform=linux/amd64`. SDK Docker images must publish a `linux/amd64` manifest; native `arm64` (or other) manifests are ignored. On Apple Silicon and other non-amd64 hosts this means containers run under emulation (slower, but functional).

This is a current limitation. If you are adding a new SDK in `packages/jammin-sdk/config/sdk-configs.ts`, make sure the image you reference is built for `linux/amd64`.
