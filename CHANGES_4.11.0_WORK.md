# In-progress changes

- Current-episode parser supports zero-based serials, length-prefixed UTF-8 Next Flight data and source references, without evaluating scripts. Exact slug/episode validation remains. Never use nextSourceFirst.
- Exact observed CDN hosts and provider loading paths added for StoryReel, DramaWave, HappyShort/ToonShort, ShortTV and GoodShort. Wrapper destinations, redirects and playlist URLs stay validated; opaque leases remain. GoodShort uses its public player key endpoint with normal player headers.
- Server FFmpeg offers HEVC/non-H264 to H264/AAC HLS compatibility: two active jobs, bounded retention, ten-minute job deadline. CPU work occurs on the Mac/backend. Some sources still fail.
- Cinezo progress saves with origin/window/title/episode validation. Resume explicitly uses VidLink and startAt; Cinezo has no supported external seeking parameter. Cinezo stays first for normal playback, embedded.
- My List access is in My Space. Home My List tab/shelf removed; favorite actions retained.
- One default profile on fresh install. Only unchanged unused legacy demos are removed with backup. Used/custom/locked profiles retained. 28 supplied image avatars replace emoji choices.
- Home and Shorts use the supplied Skiper48-style cards transition with actual catalogue posters, dots/swipe and visibility-aware trailers. Skiper UI attribution retained.

## Verification and remaining work

57 Node checks, typecheck and build passed. Browser regressions cover captions/retry/episodes, My Space, categories, simulated Cinezo progress and stable VidLink resume URL. Design checks cover both card heroes and mobile overflow. Real remote StoryReel playback advanced at 720x1280 in Chromium. Real HEVC source compatibility probes yielded H264/AAC. No real iPhone/Safari test.

The metadata census covers 10,695 English/Arabic series, NOT playback of every episode. Provider media probes are samples, not all episodes. HTTP403/410 and several key/segment failures remain. User requested no release until broad playback is verified: this is a work checkpoint only.

## Completed catalogue audit

One episode from every one of 10,695 listed English/Arabic series was checked through the app resolver and media relay, including actual video frame decoding. 10,455 passed; 240 remain unverified or unavailable. 798 compatibility conversions were verified. This tests the start of playback, not every episode or a real iPhone. See verification/MoroShow_Shorts_Audit.html.

Additional fixes: current-player Unicode book IDs, bounded same-CDN gateway fallback, cyclic playlist detection, MIME/BOM handling, direct JoyReels transport, cancel compatibility jobs on exit, and a 40-second source-resolution deadline. Deadline abort regression passed.

This is still a work checkpoint because source failures remain. No unavailable title was silently removed. Preserve .env and profile data.
