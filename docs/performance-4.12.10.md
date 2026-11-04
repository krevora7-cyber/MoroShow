# Performance update 4.12.10

- Guest catalogs start alongside profile discovery; guest history/favorite reads are skipped.
- Removed the fixed 900 ms splash delay and split unused dialogs and preview fixtures out of the entry bundle.
- Signed-in profiles are validated against the authenticated account ID in the profile response, eliminating a separate blocking configuration request.
- Overlapping authentication and read-only account-state requests share network work per token. No completed session/state response is cached; mutable account state is cloned per request and writes still use optimistic revision checks.
- Movie/series Play opens the single configured CineSrc source immediately. Removed four misleading source choices that all resolved to the same provider.
- Metadata persists locally with profile/Kids-specific keys; stale metadata refreshes in the background. Playback leases are never cached.
- Hero metadata reuses the catalog cache and no longer repeats an artwork request for every slide.
- TV publishes each completed directory without waiting for the slowest provider. The guide refreshes while the remaining directories load.
- Automatic TV fallback probes up to three candidates concurrently; explicit source selection retains priority. Failed/played source IDs remain tracked.
- Production startup does not import Vite. Hashed assets served by Express have immutable caching.
- Shorts source, episode preparation, subtitles and playback implementation remain unchanged.

Validation: TypeScript, production build, account isolation/ownership/revision checks, TV merge/routes, popup sandbox, catalog/Kids filtering, Shorts preparation, and new concurrency/first-directory tests. The entry JS fell from 645.85 kB to about 595 kB (gzip about 189 kB to 174 kB), measured with the same build environment.

Limitations: Render's current Free service sleeps on inactivity. Code cleanup does not remove its cold-start delay. External player/media startup depends on provider and network. Browser automation was blocked by the runtime's Chromium socket restriction; real-device playback is not claimed as verified.
