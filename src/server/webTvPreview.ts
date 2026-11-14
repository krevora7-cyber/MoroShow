import express from 'express';
import { NetShowDatabase, withAccountDatabase } from './db';
import { registerPublicTv } from './publicTv';

const app = express();
app.use(express.json({ limit: '16kb' }));
app.get('/health', (_req, res) => res.status(200).send('ok'));
app.use('/api/live', (req, res, next) => {
  if (req.method === 'GET' && /^\/media\/[a-f0-9]{48}$/.test(req.path)) return next();
  const catalogRequest = req.method === 'GET' && req.path === '/channels' && req.query.catalog === 'xtream';
  const playRequest = req.method === 'POST' && req.path === '/play' && req.body?.catalog === 'xtream';
  if (!catalogRequest && !playRequest) return res.sendStatus(404);
  const profileId = String(req.query.profileId || req.body?.profileId || '');
  const authorization = req.get('Authorization');
  void (async () => {
    try {
      const response = await fetch('https://moroshow.onrender.com/api/profiles', {
        headers: authorization ? { Authorization: authorization } : {},
        signal: AbortSignal.timeout(12000),
        redirect: 'error',
      });
      if (!response.ok) return res.sendStatus(response.status);
      const result = await response.json();
      const profile = result.profiles?.find((entry: {id: string}) => entry.id === profileId);
      if (!profile) return res.status(401).json({ success: false, error: 'Select a profile first.' });
      withAccountDatabase(new NetShowDatabase({ profiles: [profile] }), next);
    } catch {
      res.status(503).json({ success: false, error: 'Profile service unavailable. Please retry.' });
    }
  })();
});
registerPublicTv(app, { accountOnly: true });
app.listen(Number(process.env.PORT || 10000), '0.0.0.0');
