#!/usr/bin/env bash
set -e

# Find binaries once
POLKAJAM_BIN="$(find /opt/polkajam -type f -name polkajam -perm -111 | head -n 1)"
POLKAJAM_TESTNET_BIN="$(find /opt/polkajam -type f -name polkajam-testnet -perm -111 | head -n 1)"
POLKAJAM_REPL_BIN="$(find /opt/polkajam -type f -name polkajam-repl -perm -111 | head -n 1)"

CMD_BIN="${1:-polkajam-testnet}"
shift || true

case "$CMD_BIN" in
  polkajam)
    exec "$POLKAJAM_BIN" ${SERVICE_ARGS}
    ;;
  polkajam-testnet)
    exec "$POLKAJAM_TESTNET_BIN" ${SERVICE_ARGS}
    ;;
  polkajam-repl)
    exec "$POLKAJAM_REPL_BIN" ${SERVICE_ARGS}
    ;;
  *)
    echo "Unknown command: $CMD_BIN"
    echo "Available: polkajam | polkajam-testnet | polkajam-repl"
    exit 1
    ;;
esac