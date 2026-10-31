# 4.9.8

Based on the supplied 4.9.7 project, preserving the existing design, Profiles, Kids, My List, Continue Watching and original .env.

- Keep a requested Shorts session visible while source resolution is pending or fails; retry targets that episode.
- Support current GoodShort HLS descriptors and two exact observed intermediary hosts. Refresh an expired current episode source instead of using a neighbouring episode.
- English Shorts catalogue/controls; discover actual episode subtitle files and save user choice. Custom cue timing plus native-track handoff prevents automatic duplicate inline rendering.
- My Space combines profile/settings and links My List.
- Lazy Home collections with real TMDB genre/country filters and a Top 10 row.
- Keep original iPhone movie embed workaround and stable resume URL.

Known external limitation: the screenshot's Arabic ShortTV episode-2 source responds HTTP 403 even after source refresh. This is recorded explicitly rather than declared fixed.

Validation: TypeScript, build, 38 Node tests, nine real Chromium UI checks. Live media: six successful episodes; one further sampled source blocked by HTTP 403. Real iPhone fullscreen/visual rendering remains unverified. See verification/release-498.json and linked reports.
