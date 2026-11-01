#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo 'iOS preparation requires macOS with Xcode.' >&2
  exit 1
fi
if ! command -v xcodebuild >/dev/null; then
  echo 'Install Xcode and command-line tools before building an iPhone app.' >&2
  exit 1
fi
if [[ -z "${VITE_NETSHOW_API_BASE:-}" || "${VITE_NETSHOW_API_BASE}" != https://* ]]; then
  echo 'Set VITE_NETSHOW_API_BASE to your deployed HTTPS MoroShow backend before building iOS.' >&2
  echo 'This is the app API origin, NOT a provider account URL.' >&2
  exit 1
fi
npm run build -- --outDir native-dist
if [[ ! -d ios/App ]]; then npx cap add ios; fi
npx cap sync ios
# Install the selected MoroShow logo in the native asset catalog.
python3 - <<'ICON_PY'
from pathlib import Path
import json, shutil
folder=Path('ios/App/App/Assets.xcassets/AppIcon.appiconset')
folder.mkdir(parents=True, exist_ok=True)
for old in folder.glob('*.png'):
    old.unlink()
shutil.copyfile('assets/icon.png', folder/'MoroShow-1024.png')
(folder/'Contents.json').write_text(json.dumps({
    'images':[{'filename':'MoroShow-1024.png','idiom':'universal','platform':'ios','size':'1024x1024'}],
    'info':{'author':'xcode','version':1}
},indent=2)+'\n')
# Replace any template splash artwork with the new branding.
splash=Path('ios/App/App/Assets.xcassets/Splash.imageset')
if splash.exists():
    for image in splash.glob('*.png'):
        shutil.copyfile('assets/splash.png', image)
ICON_PY
cp ios-support/MoroProtectedPlayerPlugin.swift ios/App/App/
cp ios-support/NetShowNativePlayerPlugin.swift ios/App/App/
cp ios-support/NetShowBridgeViewController.swift ios/App/App/
# Capacitor 7/8 template: replace storyboard class with the app-local plugin host.
python3 - <<'PY'
from pathlib import Path
p=Path('ios/App/App/Base.lproj/Main.storyboard')
if not p.exists():
    raise SystemExit('Main.storyboard missing; manually register NetShowBridgeViewController in Xcode.')
s=p.read_text()
if 'customClass="NetShowBridgeViewController"' not in s:
    import re
    pattern=r'customClass="CAPBridgeViewController"(?: customModule="[^"]+")?'
    s, n = re.subn(pattern, 'customClass="NetShowBridgeViewController" customModule="App"', s)
    if n < 1:
        raise SystemExit('Storyboard template changed; set the initial ViewController class to NetShowBridgeViewController in Xcode.')
    p.write_text(s)
PY
echo 'Open ios/App/App.xcworkspace (or App.xcodeproj for SwiftPM) in Xcode.'
echo 'Check that all three Swift source files belong to the App target (Target Membership).'
echo 'Choose an Apple Development team, connect iPhone, then Run.'
