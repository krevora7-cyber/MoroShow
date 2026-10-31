#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -f .env ]; then cp .env.example .env; echo 'Edit .env: set NETSHOW_ADDON_BRIDGE_URL from your already-running Android TV Server screen.'; fi
node --experimental-strip-types --test tests/addonGateway.test.mjs
node --experimental-strip-types scripts/check-addon-gateway.mjs
