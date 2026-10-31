# MoroShow — 4.12.7

React + TypeScript + Vite frontend, Express backend. This repository excludes credentials and local user data.

## Vercel frontend

1. Import this private repository at https://vercel.com/new.
2. Framework: Vite. Root directory: repository root. Build: `npm run build`. Output: `dist`. Node: 24.x.
3. For the initial interface review leave `VITE_NETSHOW_API_BASE` empty. The vercel.app deployment shows a labelled interface preview with a static TMDB catalogue snapshot. Playback and account services require the backend.
4. When the HTTPS backend is available, set `VITE_NETSHOW_API_BASE=https://your-backend.example` in Vercel and redeploy. Configure that backend to allow the Vercel origin through CORS.

**The initial static deployment is not a working streaming service.** Profiles, catalogue, media resolution and history currently depend on Express. No API secrets belong in `VITE_*` variables.

The preview is automatically disabled when VITE_NETSHOW_API_BASE is configured. It is not a streaming-service deployment.

## Local complete application

`npm ci` then copy `.env.example` to `.env`, enter backend credentials locally, and run `npm start`.

Do not commit `.env`, local data or accounts. The original local application folder remains separate.
