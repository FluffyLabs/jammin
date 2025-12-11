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
