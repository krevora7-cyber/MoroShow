# Full online application

All frontend and Express backend source is included. Vercel hosts the static frontend; the running Express server provides profiles, catalogue, TV and Shorts. A frontend preview is not the full service.

## Backend container

Build: `docker build -t moroshow .`
Run: `docker run --env-file .env -e NODE_ENV=production -p 3000:3000 -v moroshow-data:/app/data moroshow`

Use an HTTPS container host. Configure TMDB_API_KEY as a backend-only secret and retain the /app/data volume across deploys. Additional source settings belong on the backend. Set NETSHOW_ALLOWED_ORIGINS to the deployed Vercel origin (comma-separated for multiple origins). Streaming leases require requests to reach the process which issued them; do not run multiple independent replicas without shared lease storage or sticky routing.

## Vercel

Import this repository using Vite, build npm run build, output dist. Set VITE_NETSHOW_API_BASE to the backend HTTPS URL, then redeploy. Add the deployed Vercel origin to the backend's allowed origins. Configure this before expecting full playback, profiles or history.

Private repository does not make user APIs authenticated. Before inviting untrusted users, implement account authentication and server-side profile ownership checks; the current local-profile API was built for trusted testing.

Never publish .env in the repository. Runtime secrets are entered in the hosting dashboard, not in Git source or client VITE_ variables.
