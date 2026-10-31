#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then npm ci --no-audit --no-fund; fi
mkdir -p verification
node --env-file-if-exists=.env --import tsx scripts/check-shorts-live.mjs
read -r -p "Press Enter to close..." _answer
