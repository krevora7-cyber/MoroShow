# NetShow v4 — Real Catalog Gateway (test foundation)

## What IS implemented
- Stremio-compatible server catalog discovery from `/manifest.json` and `/catalog/{type}/{id}.json`.
- Server-side import into the EXISTING NetShow Movies / Series / Live UI; no new frontend theme.
- Real posters, titles, and descriptions **if** returned by the configured compatible API.
- On-demand `/stream/{type}/{videoId}.json` resolution when the user presses Play.
- On-demand episodes from `/meta/series/{id}.json`.
- Events page displays Cricify items **only** when a dedicated Cricify-compatible catalog identifies them; no invented match schedules.
- Server playback tokens, profile data, and signed proxy remain in place.
- Four separate SOURCE SLOTS: CNC Verse, StreamPlay, Yacintv, Cricify. One optional shared Bridge slot.
- A diagnostic CLI and local protocol integration tests.

## What is NOT yet implemented / verified
- No `.cs3` Kotlin/Android runtime inside this app; repo manifests alone cannot deliver streams.
- NO confirmed streaming from any of the four selected CloudStream extensions.
- No claim that a common Bridge catalog can attribute a title to any particular extension.
- No production-ready iPhone IPA/TestFlight build; Swift native player files are retained from V3.9 but must be built and tested in Xcode.
- The public media sample at `/player-lab` only tests HLS playback and does not import content.

## How to test using your already-installed TV bridge (no APK reinstall)
1. Unzip in `~/Downloads/NetShow_v4_Real_Catalog_Gateway` on Mac.
2. In Terminal, inside that directory, run `cp .env.example .env`.
3. In `.env`, uncomment `NETSHOW_ADDON_BRIDGE_URL=` and enter the **actual LAN URL shown by the app's Server screen**. Example only: `http://192.168.1.50:8080/manifest.json`. Your Mac and TV must be on the same Wi-Fi. `127.0.0.1` would point to the Mac, NOT the TV.
4. Run `npm install`, then `npm run diagnose:gateway`; inspect per-source status and stream resolution, then run `npm run dev`.
5. In Chrome on Mac, open `http://127.0.0.1:3000`, select a Profile, and open Movies/Series/Live TV.
6. For a machine-readable report open `http://127.0.0.1:3000/api/source-status` (doesn't reveal provider stream URLs). Also test `http://127.0.0.1:3000/player-lab` for the independent HLS player.

**If Bridge does not expose catalogs or plugins configured on the TV**, NetShow will correctly show `not_configured`, `error`, or zero items. This is not a verified standalone CloudStream integration. Some addons expose streams only for a user-selected IMDb ID and have no home catalogs; those will require a different content-discovery method. DRM-protected streams, magnet links, and unsupported codecs won't play automatically in Chrome/iOS.

To use FOUR direct adapters instead of one aggregate Bridge, set the four individual `NETSHOW_ADDON_*_URL` variables to actual Stremio-compatible endpoints. CloudStream `.cs3` repo URLs **cannot** be used in those settings.

## Tests
- `npm run test:gateway` (protocol fixture tests; no network or video decoding)
- `npm run diagnose:gateway` (actual configured endpoints; requires network and an addon server)
- `npm run dev` (full NetShow app; dependencies must be installed)

## Safety and legal scope
Only connect content sources you are authorized to use and distribute. `NETSHOW_ADDON_*` is configured by the local app administrator, not accepted from remote users. Media URLs are checked before proxying, private URLs are allowed only if they share an explicitly configured addon origin. This remains a developer preview, not a hardened public multi-user deployment. The Bridge itself is a separately licensed product — **no code was copied from it**.
