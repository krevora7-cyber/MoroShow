# MoroShow 4.10.0

Continue the existing project. Stop the old terminal with Ctrl+C, extract this ZIP in Downloads, then:

```bash
cd ~/Downloads/MoroShow_4.10.0 && bash START_MOROSHOW.command
```

Keep the Mac on and use the same Wi-Fi. The launcher prints the phone URL. Original .env is unchanged and included. Existing sibling 4.9.9/4.9.8/4.9.7 profiles, My List and history are imported once only if this folder has no data.

## Changes

- Compact English/Arabic catalogue selector alongside Shorts search. Removed the separate language row and explanatory paragraph. Subtitle selection remains inside the player.
- All movie/series servers now render in the app iframe, including Cinezo on iPhone and VidSrc.sh. Cinezo stays first. Removed the external-window screen, toolbar link and external playback buttons. Existing sandbox permissions remain unchanged.
- Permit only the observed v2-akm.goodreels.com CDN host for the reported Arabic episode. Redirect, playlist and opaque lease restrictions remain active. Other arbitrary GoodReels subdomains are blocked.
- Profiles, Kids, My List, Continue Watching, captions, Home shelves and TV-off behaviour retained.

## Verification and limits

Typecheck, production build and 42 Node tests passed. Eleven Chromium UI checks passed, including the in-app Cinezo iframe and absence of external actions. The movie iframe structure was checked; successful Cinezo movie playback on a real iPhone was NOT verified. External server errors can still happen inside their players.

Actual remote episode 1 of «الحكيم الأعظم وغضبه الإلهي» played inside the app in Chromium: advancing time, 720×1280, duration 162.32 seconds. Episodes 1 and 2 returned valid relayed HLS video bytes. This is not a claim that every episode is verified. Other source errors, including upstream HTTP403, can still occur.

See verification/*4100.json for this release. Earlier reports are historical. No real iPhone/Safari test was performed. No subtitle file was generated or invented; source-provided files remain viewer-selectable.
