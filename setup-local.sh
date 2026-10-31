#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
# This four-extension SOURCE-REGISTRY trial does not load or copy any IPTV credentials.
# Only safe profile definitions (name/avatar/PIN metadata) may be copied locally.
if [ ! -f data/netshow-state.json ]; then
  for base in ../NetShow_v3.7 ../NetShow_v3.6 ../NetShow_v3.4 ../NetShow_v3.3; do
    if [ -f "$base/data/netshow-state.json" ]; then
      mkdir -p data
      node scripts/migrate-profiles-only.mjs "$base/data/netshow-state.json" data/netshow-state.json
      echo 'Copied profile definitions only; old IPTV settings and history were not imported.'
      break
    fi
  done
fi
npm install
npm run dev
