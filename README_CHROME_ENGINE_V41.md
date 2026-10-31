# NetShow v4.1 — Chrome Native Provider Core (DEVELOPMENT ONLY)

**NOT a completed NetShow streaming application.** This is a genuine, integrated, first-party Node.js/TypeScript provider execution framework, built on the existing NetShow v4 frontend and backend. It works *without Android TV or CNCVerse Bridge* for properly implemented Node-native provider adapters. There are currently **zero production provider adapters registered**, so CNC Verse, StreamPlay, Yacintv and Cricify **do not yet produce playable catalog entries**. An Android `.cs3` file or CloudStream `cloudstreamrepo://` URL cannot execute on Chrome directly.

## What changed from v4

- `src/server/chromeProviderEngine.ts`: first-party provider execution with parallel catalog fetch, source-by-source failure isolation, strict mapping of each of the four requested source names to allowed NetShow sections, poster/backdrop fields, per-series episodes, per-item playback URL resolution, and differentiated source statuses (`not_ported`, `working`, `failed`). Kid profiles remain opt-in for each verified kid-safe item.
- `src/server/providers/index.ts`: allowlisted local TypeScript adapter registry. Empty on purpose until independently implemented adapters are tested against real upstream sources and reviewed for licensing. **Do not label the four adapters 'working' until tested.**
- `src/server/httpJsonProvider.ts`: optional reusable JSON adapter for authorized HTTP-based services. It expects GET `/catalog`, GET `/series/<id>/episodes`, GET `/stream/<id>`. This is a protocol contract and does not magically convert CloudStream extensions into HTTP APIs.
- `server.ts`: the normal `/api/catalog`, `/api/series/:id/episodes`, and `/api/stream/token` endpoints now support local providers in addition to the *optional* old addon gateway. The original NetShow UI, player and profile logic are kept unchanged. The previously supplied Xtream credentials are not present or used.
- `tests/chromeProviderEngine.test.mjs` and `tests/chromeProviderHttp.test.mjs`: six actual locally executed code tests, including catalog -> episode -> stream resolution over a real local HTTP server. **Test content and URLs are synthetic** and are never shown as real live channels or movies.

## Technical proof (verified in the workspace)

`npm run test:browser-engine` => 6 tests passed.

Static TypeScript/TSX syntax transpilation check => 38 files parsed without syntax errors. This is NOT a full `npm run build` or typecheck: package installation was impossible in this environment because external DNS/network access is disabled. The existing web app also has not been tested in a browser here.

## How to use the development source

In a Mac terminal (Node.js >= 22 recommended):

```bash
cd ~/Downloads/NetShow_v4.1_Chrome_Provider_Core
npm install
npm run test:browser-engine
npm run dev
```

Open `http://127.0.0.1:3000` in Chrome. The video catalog can legitimately be empty while the four real adapters are still missing. DO NOT treat this as an end-user test build. No old IPTV `.env` or credentials are required or desired.

## What is **still required** before a complete test on Chrome

1. Obtain/review **actual provider source or authorized HTTP endpoints** for CNC Verse and StreamPlay, then independently port their `mainPage`/`search`/`load`/`loadLinks` logic into `ProviderAdapter` implementations.
2. Port Yacintv live channel indexing and playback, with valid/authorized HLS URLs and browser codec/CORS handling.
3. Port Cricify event listing and live stream resolution; an extension's `Live` type alone does not establish a dated event schedule.
4. Verify movies, series, episodes, live channels and sports events from the **real sources** in Chrome (not fixtures), fix any format incompatibilities, and review original license terms plus authorization to stream the copyrighted content.
5. Only after the four end-to-end tests succeed, prepare the installable iPhone app and native AVPlayer integration.

### Plugin-to-section contract

| Requested extension | NetShow destination | Ported? |
| --- | --- | --- |
| CNC Verse | Movies + Series | No |
| StreamPlay | Movies + Series | No |
| Yacintv | Live TV | No |
| Cricify | Events + Sports | No |

**Honest status:** Browser-independent provider runtime exists and passed unit/integration tests; **none** of the four CloudStream sources has been demonstrated streaming in Chrome.
