# 4.9.9

Continues the supplied 4.9.7 → 4.9.8 project without resetting the app.

- Permit the exact observed cdn2.nsstorage.space media host; preserve URL checks, redirect checks, opaque leases and HLS/Range relay.
- Cinezo first across platforms. Retain the iPhone separate-window workaround and put the Cinezo action first.
- Optional Arabic Shorts catalogue with English UI to access the source's Arabic editions and captions where provided.
- Distinguish complete missing-subtitle results from incomplete/failed locale checks; do not negatively cache network or unsupported-host failures.
- Import existing sibling 4.9.8/4.9.7 profile data once when a new version has no data; never overwrite existing data or .env.

Verification reports are in verification/*499*.json. Source files and original .env are included. Real iPhone fullscreen remains unverified.

Validation: 41 Node tests, typecheck and production build passed. Real Chromium playback of the reported Don title and a real Arabic caption overlay were verified; live iPhone behaviour remains unverified.
