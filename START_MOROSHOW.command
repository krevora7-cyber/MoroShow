#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Install Node.js 24 first."; exit 1; }
if command -v lsof >/dev/null && lsof -tiTCP:3000 -sTCP:LISTEN >/dev/null; then
  echo "Port 3000 is already used. Stop the OLD MoroShow terminal with Ctrl+C, then launch this file again."
  exit 1
fi
# Import existing local profiles/lists once, without overwriting a new version's data.
if [ ! -e data ]; then
  for moroshow_previous in "../MoroShow_4.12.8" "../MoroShow_4.12.7" "../MoroShow_4.12.6" "../MoroShow_4.12.5" "../MoroShow_4.12.4" "../MoroShow_4.12.3" "../MoroShow_4.12.2" "../MoroShow_4.12.1" "../MoroShow_4.12.0" "../MoroShow_4.11.1" "../MoroShow_4.11.0" "../MoroShow_4.10.0" "../MoroShow_4.9.9" "../MoroShow_4.9.8" "../MoroShow_4.9.7"; do
    if [ -f "$moroshow_previous/data/netshow-state.json" ]; then
      mkdir -p data
      cp "$moroshow_previous/data/netshow-state.json" data/netshow-state.json
      chmod 600 data/netshow-state.json
      echo "Imported your existing profiles, My List and Continue Watching."
      break
    fi
  done
fi
if [ ! -f .env ]; then
  for previous in "../MoroShow_4.12.8" "../MoroShow_4.12.7" "../MoroShow"; do
    if [ -f "$previous/.env" ]; then cp "$previous/.env" .env; chmod 600 .env; break; fi
  done
fi
if [ ! -f .env ]; then
  echo "Copy your previous MoroShow .env into this folder (TMDB and account settings), then run again."
  exit 1
fi
if [ ! -d node_modules ]; then npm ci --no-audit --no-fund; fi
printf 'MoroShow 4.12.9 — open http://localhost:3000 — keep this Terminal open.\n'
if command -v ipconfig >/dev/null; then
  moroshow_ip=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)
  if [ -n "$moroshow_ip" ]; then printf 'Mobile (same Wi-Fi): http://%s:3000\n' "$moroshow_ip"; fi
fi
NODE_USE_ENV_PROXY=1 NODE_ENV=production npm start
