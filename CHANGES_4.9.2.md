# MoroShow 4.9.2

- Animation is now labelled Anime. Clips is now labelled Shorts.
- Removed oversized category headings and taglines from Movies, Series, Anime, Search and Shorts.
- Shorts only uses DramaBox, GoodShort and ReelShort. DramaTip is no longer a selectable or active catalog/playback source; old DramaTip history entries cannot play.
- Added provider-specific catalog, search, episode and playback adapters, server-only credentials, MP4 playback and bounded HLS/key media routes.
- Kept existing movie/series server choices and Kids restrictions.

## Run

Use Node.js 24. Copy your existing .env into the extracted project (do not publish it). Add these values if using GoodShort/ReelShort:

```
GOODSHORT_AUTH_TOKEN=your_goodshort_token
REELSHORT_AUTH_TOKEN=your_reelshort_token
GOODSHORT_API_URL=https://reelapi.it.com/goodshort/api/v1
REELSHORT_API_URL=https://captain.sapimu.au/reelshort/api/v1
SHORTS_LANGUAGE=en
```

DramaBox uses the supplied unofficial client's token generation. It does not use the other providers' tokens. GoodShort uses one consistent base URL; change it to the endpoint supplied by your API provider if different.

Stop the old MoroShow process. Launch START_MOROSHOW.command from this new extracted folder. Dependencies install automatically on first launch. Open http://localhost:3000, select an adult profile, then Shorts and a provider.

Run CHECK_SHORTS.command to save a fresh diagnostic in verification/shorts-current.json. The diagnostic checks the catalog, first title's episodes and first episode's stream resolution; it does not prove browser playback. Locked first episodes may produce a failure even when other episodes work.

## Verification on 2026-10-28

TypeScript and production build passed. The 12 existing web-source/playback tests passed, as did 3 new adapter/credential/media tests (the adapter tests use local fixtures, not live provider data).

Live attempts: DramaBox failed DNS resolution for sapi.dramaboxdb.com (EAI_AGAIN) from the build environment. GoodShort and ReelShort lacked their required tokens. No live catalog, episode playback, or subtitle availability has been verified. No sample series or generated playback URLs are used in the app. The supplied APIs may change or require access from the user's network.

The existing Anime catalog still uses TMDB animation genre 16; this update changes its label, not its genre coverage.
