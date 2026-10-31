# MoroShow 4.6

Movies, series and TV use the existing configured Xtream source. Events retain the previous Cricify source.

- Stream redirects are followed inside the server, bounded to six hops; each destination is checked.
- Relative HLS segments and encryption-key links resolve against the final manifest location.
- Range requests, source-specific headers and subtitle conversion remain supported. Credentials are stripped on cross-origin redirects.
- Upstream inactivity produces a timeout; closing the player cancels the active upstream request.
- Unavailable titles produce an error. No sample video replaces a selected film or channel.
- Hero rotates every 18 seconds even with a trailer, with the slideshow pause button removed. Only provider/matched metadata trailers are used.
- Shelves support mouse dragging, native touch scrolling and automatic scrolling; no side arrows. Offscreen shelves and reduced-motion users do not auto-scroll.

Validation: TypeScript check and production build passed; 12 utility tests, 17 gateway tests, routing integration and 9 proxy checks passed with fixtures. No real Xtream video decoding, audible audio, subtitle rendering or iPhone playback was verified in this environment. UI changes were build-checked, not browser-tested.

To start, stop the previous server with Ctrl+C, extract the archive, then run:

    cd ~/Downloads/MoroShow_v4.6
    bash START_MOROSHOW.command

Open http://localhost:3000. Settings should show MoroShow 4.6.
