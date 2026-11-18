# MoroShow — 4.12.7

React + TypeScript + Vite frontend, Express backend. This repository excludes credentials and local user data.

## Vercel frontend

1. Import this private repository at https://vercel.com/new.
2. Framework: Vite. Root directory: repository root. Build: `npm run build`. Output: `dist`. Node: 24.x.
3. Vercel forwards same-origin `/api/*` requests to the MoroShow backend on Render. Leave `VITE_NETSHOW_API_BASE` empty to use that route for browser deployments. To point at another backend, set the variable to its HTTPS base URL and configure its allowed origins.
4. For a standalone interface demo, set `VITE_MOROSHOW_INTERFACE_PREVIEW=true` and leave `VITE_NETSHOW_API_BASE` empty.

The backend provides profiles, catalogue, media resolution and history. Keep API secrets out of `VITE_*` variables.

## Local complete application

`npm ci` then copy `.env.example` to `.env`, enter backend credentials locally, and run `npm start`.

Do not commit `.env`, local data or accounts. The original local application folder remains separate.

### Movie and series playback sources

The movie and episode picker includes VixSrc and VidLink. Each opens its official embedded player by default. To use a reviewed Nuvio provider bundle, set `MOROSHOW_VIXSRC_PLUGIN` or `MOROSHOW_VIDLINK_PLUGIN` to its absolute path on the Node 24 backend and restart. Supply the compiled CommonJS file exporting `getStreams(tmdbId, mediaType, season, episode)`. Install only code you trust. The backend passes the exact TMDB title and episode to the bundle in a short-lived process. It does not install code from catalog URLs.

Alternatively, set `MOROSHOW_VIXSRC_ADDON` or `MOROSHOW_VIDLINK_ADDON` to a provider-specific HTTPS Stremio manifest URL ending in `/manifest.json`. The backend uses the corresponding IMDb movie or series stream resource. It tries configured sources in this order: local provider bundle, HTTP addon, then the official embedded player. Direct playback accepts HTTPS HLS or MP4 links usable without custom request headers. The player also accepts WebVTT subtitle links. A server that returns a direct stream must permit browser playback of that stream.

Watch history stores the source and position separately for each profile and episode. VidLink, Vidstuck and VixSrc support web resume through their player interfaces. Native protected playback samples an accessible video in the selected top-level page. Sources that hide the video in another frame or omit progress events may not report a position. Updated native plugins require a new app build.
