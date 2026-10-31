#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "${VITE_NETSHOW_API_BASE:-}" != https://* ]]; then
 echo 'Set VITE_NETSHOW_API_BASE=https://YOUR_BACKEND_HOST first.' >&2
 exit 1
fi
npm run build
if [[ ! -d android/app ]]; then npx cap add android; fi
npx cap sync android
# Launcher artwork is separate from the text-only in-app welcome screen.
python3 - <<'ICON_PY'
from pathlib import Path
import struct,zlib
# Use the supplied PNG through Android drawable resources; Android will scale it.
import shutil
res=Path('android/app/src/main/res')
(res/'drawable').mkdir(parents=True,exist_ok=True)
shutil.copyfile('assets/icon.png',res/'drawable/moroshow_launcher.png')
shutil.copyfile('assets/splash.png',res/'drawable/moroshow_splash.png')
for folder in res.glob('drawable*'):
 for p in folder.glob('splash.png'):
  shutil.copyfile('assets/splash.png',p)
manifest=Path('android/app/src/main/AndroidManifest.xml')
s=manifest.read_text().replace('@mipmap/ic_launcher_round','@drawable/moroshow_launcher').replace('@mipmap/ic_launcher','@drawable/moroshow_launcher')
manifest.write_text(s)
ICON_PY
npx cap open android
