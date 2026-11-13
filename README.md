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
