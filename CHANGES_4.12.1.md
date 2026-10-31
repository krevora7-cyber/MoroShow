# 4.12.1 — TV source validation and recovery

Continues the supplied 4.12.0 GEIL TV project.

- beIN category now requests Arabia, avoiding identically named French/Turkish feeds. Those remain available through country categories / All channels.
- Check the resolved HLS playlist and actual media bytes before handing a feed to the player. HTML error pages with HTTP 200 are not accepted as video.
- Look up alternative renditions of the same channel in the same country. Preserve channel number and Premium/Max/AFC distinctions. No unrelated-channel substitution.
- Try up to three feeds sequentially, with a 20-second per-feed deadline and a 65-second overall deadline. Avoid opening several competing feeds concurrently. Healthy sources do not wait for the deadline.
- The player can request another rendition after an actual playback failure, excluding failed feeds, with at most two automatic recoveries. Manual retry starts a fresh attempt. A single-feed channel can refresh its expiring URL.
- Prefer hls.js when MSE is supported on desktop/Android instead of trusting partial native-HLS advertising; keep native HLS on iPhone/iPad.
- If audible autoplay is denied after asynchronous resolution, attempt muted playback and retain an explicit Play control if the browser still blocks it.
- Abort resolution on disconnect/channel change, reject private network destinations, and retain opaque media URLs and Kids restrictions.
- Existing Home, Shorts, profiles and all 28 avatars are retained. .env remains byte-for-byte unchanged. The launcher imports existing 4.12.0 profile data into an empty new installation.

## Verification and limits

TypeScript and production build passed. 25 distinct Node checks passed across TV, existing playback presentation, Shorts continuation and profiles; this includes same-channel fallback and cancellation tests.

Arabic beIN Sports 1–9 HD each reached a successful five-frame FFmpeg decode through the application's relay during the verification rounds. Earlier attempts included timeouts: reports retain those results instead of claiming uninterrupted availability. These are point-in-time tests, not a full TV catalogue audit or an uptime guarantee.

Two Chromium mobile-viewport runs reached actual beIN 1 video; later live-browser runs timed out during reconnection. See tv-browser-history-4121.json and tv-browser-live-4121.json. Controlled UI recovery/autoplay tests use a generated H264/AAC HLS fixture (tv-ui-4121.json). A mobile viewport is not a real iPhone. Native Safari/iPhone playback is not verified here.

The last live-browser attempt could not obtain a reachable source for beIN 1; it is retained in tv-browser-4121.json. The update improves validation and recovery but does not resolve upstream availability or prove parity with VYPN.

This does not add a VPN or VYPN native browser capabilities. Streams are requested by the Express backend (the Mac during local testing). If a provider is reachable only through a particular VPN/network, a frontend update alone cannot give the backend that network route.
