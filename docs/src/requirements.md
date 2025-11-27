# Requirements

All jammin tooling expects a recent macOS or Linux environment with the tools below available globally.

## Node.js (LTS via nvm)

```bash
# macOS
brew install nvm
mkdir -p ~/.nvm && echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.zshrc
source $(brew --prefix nvm)/nvm.sh
nvm install --lts

# Linux
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh"
nvm install --lts
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

Verify each tool with `node --version`, `docker --version`, and `git --version` before running jammin commands.
