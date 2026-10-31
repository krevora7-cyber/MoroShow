# 4.12.0 — reference-style TV with GEIL

Based on the user-supplied MoroShow_4.11.1.zip, not 4.10.2.

- Added TV navigation, hidden for Kids; server also denies Kids access.
- Reference layout: fixed video above independently scrolling channel and category columns, categories on the right. Dark surfaces with restrained purple accents, beIN first.
- GEIL addon catalog integration uses observed search, filter[group] and cursor pagination. Brand and country categories are separate. No invented USA channels.
- Resolve a fresh playback URL on play/retry. Local opaque media leases rewrite HLS playlists, keys and segments to avoid mixed-content/CORS issues. Public-IP validation is repeated for redirects; arbitrary client URLs are not accepted.
- Original MoroShow HLS player styling, inspired by the reference; GEIL/Vuma player code is not copied or embedded. Native Safari HLS and hls.js desktop playback, auto quality, manual quality if available, pause, mute, fullscreen and bounded reconnect.
- Preserve the uploaded version's Home, Shorts, supplied 28 avatars, family profiles, and .env. Launcher imports adjacent 4.11.1 profiles once.

Validation: TypeScript and production build passed. 31 Node tests passed, including TV filtering/security, supplied avatar preservation, profile behavior and existing Shorts regression tests. Chromium verified 390x844 and desktop layout, category selection, click/retry and empty states. A generated local H264/AAC HLS fixture actually played; pause and mute were verified. See verification/tv-ui-4120.json.

External check: GEIL beIN first page returned 300 records plus another page cursor; the resolver returned a URL for BEIN SPORTS 1 (1). External manifest/video could not be reached in this environment (EAI_AGAIN), so external playback is unverified. See verification/geil-live-4120.json. No native iPhone test claim.
