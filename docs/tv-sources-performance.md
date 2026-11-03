# Unified TV and playback update

TV now combines IPTV-org, IPTV Nexus, Free Public IPTV, and Doubo. Each directory has an independent last-successful snapshot; a failed refresh does not erase working data. Snapshots refresh every six hours. Initial failure retries after 30 seconds. Only HTTP(S) HLS/MP4 entries without credentials are imported; explicit adult categories are excluded.

Channel identity uses tvg-id, removing quality-only suffixes. Regional editions, channel numbers, countries and languages remain separate. Untagged names only join an unambiguous identity. The same media URL appears once per channel. The catalog does not expose upstream addresses; playback retains the existing opaque lease and private-network protection.

Source selection tries the requested source first, then at most two alternatives per request. HLS probes check media bytes as well as the manifest. Failed IDs are returned to the client, which continues through the remaining sources with a bounded retry count. MP4 compatibility is determined by actual browser playback. Search precedes the categories; phone playback sits above the guide, desktop playback beside it. Lists scroll independently.

Movies and series now have CineSrc as Source 1 and distinct Source 2–5 options. Popup-blocked mode keeps the selected provider instead of remapping every button to CineSrc. Standard and Compatibility are retained as explicit choices. Some third-party sources refuse sandboxed frames; this update does not bypass that restriction or guarantee ad-free playback. Video-embedded advertising cannot be removed by the iframe sandbox.

## Loading changes

- HLS/TV code loads on demand rather than in the initial application bundle.
- The home hero mounts without waiting for both catalog sections.
- Catalog keys normalize parameter order, irrelevant movie catalog filters, and page 1. Profile and Kids mode remain in the key. Stale catalog metadata can render immediately while it refreshes. Playback credentials are not persisted.
- Near the end of a Shorts episode, prepare the next verified episode's media lease and codec probe. This work is shared between prefetch and playback, expires after 60 seconds, and is consumed once. Prefetch is bounded to two jobs and never launches transcoding. Data-saving connections skip it.

## Validation

`npm run typecheck`, `npm run build`, and `npm run test:playback-update` pass (27 tests). Tests cover channel identity, source ordering/exhaustion, private-address rejection, account/profile isolation, Kids restrictions, episode identity, and prefetch reuse/recovery.

Chromium smoke checks at 1440×1000 and 390×844 used mocked APIs: channel search, explicit Source 2 request, automatic fallback after media failure, and phone guide bounds passed. These are UI/integration checks, not real-stream or physical-device verification.

A live catalog fetch on 2026-11-03 returned supported entries from all four directories: 10,975 IPTV-org, 14,996 Nexus, 103 Free Public, and 4,765 Doubo. These merged to 12,033 entries; 3,722 had multiple distinct sources. Counts vary and do not establish stream availability or redistribution rights.

Production build: initial JS 647.27 kB (189.69 kB gzip); HLS 574.30 kB is separate and lazy. The build still warns about large chunks and existing Vite config usage.

## Release and remaining checks

Deploy backend and frontend from the same commit. No account migration or new environment variables. Verify guest TV, real HLS playback, Shorts transition, and iPhone Safari/Android TV remote navigation on actual devices before broad rollout. Directory uptime, geoblocking and third-party embed restrictions remain external dependencies.

Doubo data attribution: https://github.com/streamline-iptv/iptv-playlists — CC BY 4.0, https://creativecommons.org/licenses/by/4.0/. Lists are combined and normalized; attribution is also visible in the TV guide.
