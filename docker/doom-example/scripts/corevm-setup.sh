#!/usr/bin/env bash
set -e

cd /opt/polkajam

NODE_HOST="polkajam-testnet"
NODE_PORT="40000"   # JAM port (NOT RPC)

echo "Waiting for JAM node at ${NODE_HOST}:${NODE_PORT}…"

# until nc -z "$NODE_HOST" "$NODE_PORT"; do
sleep 40
# done

echo "JAM-NP is available"

echo "Creating CoreVM…"

OUTPUT=$(./jamt vm new ./doom.corevm 1000000000 \
  --node "${NODE_HOST}:${NODE_PORT}")

echo "$OUTPUT"

SERVICE_ID=$(echo "$OUTPUT" | grep -Eo '[0-9]+' | head -n 1)

if [ -z "$SERVICE_ID" ]; then
  echo "Failed to extract SERVICE_ID"
  exit 1
fi

echo "SERVICE_ID=$SERVICE_ID"
echo "$SERVICE_ID" > /data/service_id

echo "Running CoreVM builder…"
./corevm-builder --accumulate-gas 1000000000 "$SERVICE_ID"

echo "CoreVM setup completed"