# 4.9.7

Fixes reported in iPhone screenshots IMG_2551, IMG_2550 and IMG_2549.

- Overlay Arabic cues in inline/container playback using TextTrack hidden mode and cuechange; ResizeObserver measures the control block. Native iOS fullscreen switches tracks to showing and restores hidden mode on exit. Caption strings are rendered as text, not HTML.
- Safari video.webkitEnterFullscreen is called inside the user click; other browsers use element.requestFullscreen. Errors are visible.
- Reuse HeroBanner with real Shorts entries. Search results remain a grid.
- Snapshot VidLink startAt only at new session/explicit reload, not on periodic history updates.
- iOS ordering favors VidLink. Cinezo internal error is worked around with direct-window mode and same-episode alternate server. No sandbox permissions were broadened.
- Launcher prints the local Wi-Fi mobile URL on Mac. Original .env preserved byte-for-byte.

Validation: npm run typecheck; npm run build; npm run test:drama-current; npm run test:web-sources; npm run test:player-ui. DOM integration evidence: verification/player-ui-497.json. Actual iPhone visual/native video testing is still required; no third-party availability guarantee.
