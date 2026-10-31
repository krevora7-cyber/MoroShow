# NETSHOW V3.9 Player Foundation — iPhone app + Chrome/Mac

This is an **isolated, installable source-code prototype** based on V3.8. It does NOT import any playable content from CloudStream. **No legacy Xtream credentials** have been carried forward. The original app style, profiles, Events/Movies/Series/Live navigation remain unchanged.

## What was added
- **Chrome player lab**: `http://127.0.0.1:3000/player-lab` with an authorized public HLS demonstration stream, MP4 and optional MPEG-TS support. Also linked from Settings → Player Test.
- **iPhone installed app pathway**: Capacitor local bundled React UI (`webDir=dist`, NO remote web UI) with two Swift files implementing an **AVPlayerViewController** plugin. Native fullscreen playback, optional seek/resume, progress and close events.
- **Reusable URL handling**: React `/api` calls use a configurable HTTPS backend when inside the locally bundled iPhone app. Proxy HLS URLs resolve against that backend rather than `capacitor://localhost`.
- **CORS restrictions**: backend responds to `capacitor://localhost` and explicit trusted domains only.
- Existing Chrome main player still uses HLS.js / mpegts.js and preserves NetShow player controls; native iPhone fullscreen uses system AVPlayer controls (not an identical custom overlay).

## Try the working player interface in Chrome on your Mac

```bash
# Extract the ZIP into Downloads so the folder is NetShow_v3.9_Player_iPhone_Chrome
cd ~/Downloads/NetShow_v3.9_Player_iPhone_Chrome
npm install
npm run dev
```

In **Chrome**, open `http://127.0.0.1:3000/player-lab` and click **Test Playback**.
The demo uses `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8`, a publicly accessible sample HLS stream. CDN and network status depend on the user's connectivity. Testing does **not** verify a CNCVerse/StreamPlay/Yacintv/Cricify video.

## Prepare the real iPhone app (on Mac + Xcode)

A self-contained installed IPA needs: Xcode, Apple signing, a real iPhone, and a deployed **HTTPS NetShow backend** (because profiles and tokens come from the server). `localhost` on the iPhone does NOT mean your Mac.

1. Deploy your legally authorized NetShow backend to HTTPS, and configure CORS/origin restrictions and backend authentication before sharing outside a private test environment. Backend security is **not production audited**.
2. In Terminal on Mac, from this project's directory:

```bash
npm install
export VITE_NETSHOW_API_BASE=https://YOUR-NETSHOW-BACKEND.example
bash scripts/prepare-ios.sh
```

3. Open `ios/App/App.xcworkspace` in Xcode (use `.xcodeproj` if no workspace is generated).
4. **Check Target Membership**: both `NetShowNativePlayerPlugin.swift` and `NetShowBridgeViewController.swift` must be in the `App` build target. If they are not shown, add them to the Xcode project (File → Add Files to App).
5. Ensure the initial view controller class in `Main.storyboard` is `NetShowBridgeViewController` from module `App` (script tries to set this automatically).
6. Choose your signing team and iPhone and press **Run**. Open the installed NetShow app → `/player-lab` (the screen is part of the bundled app; testing it may require a menu link to Player Test or opening Settings → Player Test).

**iOS native video prerequisites:** HTTPS HLS (.m3u8) or MP4 with compatible codecs; raw `.ts` is not supported by AVPlayer as an independent MPEG-TS live stream. AVPlayer support does not remove DRM or obtain content rights.

## What is and isn't verified here
- Code-generation and TypeScript/TSX **syntax** can be checked locally without dependencies.
- An actual `npm run build` requires downloading npm packages.
- iOS compilation/signing and on-device playback **must be tested on a Mac with Xcode**. There is no Xcode in this build environment, so the IPA has **not** been built or tested.
- Provider-specific extension runtime is **not implemented**. The four selected extensions remain metadata-only. Do not distribute it as an app with working movies, sports, or channels.

## Rollback
This folder is independent of every existing NetShow version. Stop the V3.9 server and relaunch the earlier folder. No source secrets are required for the player lab.
