#!/usr/bin/env bash
set -e

cd /opt/polkajam

echo "Waiting for SERVICE_ID…"

while [ ! -f /data/service_id ]; do
  sleep 1
done

SERVICE_ID=$(cat /data/service_id)

echo "Launching CoreVM monitor for SERVICE_ID=$SERVICE_ID"
exec ./corevm-monitor "$SERVICE_ID"