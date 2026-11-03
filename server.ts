import {iptvEnabled} from './src/server/iptvAccounts';
import {registerIptvVod} from './src/server/iptvVod';
import 'dotenv/config';
import express, {type Request, type Response} from 'express';
import {createServer as createViteServer} from 'vite';
import {db} from './src/server/db';
import {registerAccountAuth} from './src/server/accountAuth';
import {registerWebSources} from './src/server/webSources';
import {registerPublicTv} from './src/server/publicTv';
const app=express();
const PORT=Number(process.env.PORT||3000);
app.use(express.json({limit:'1mb'}));
const trustedOrigins=new Set(['capacitor://localhost','https://localhost',...String(process.env.NETSHOW_ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean)]);
app.use((req,res,next)=>{
 const origin=String(req.headers.origin||'');
 if(origin&&trustedOrigins.has(origin)){res.header('Access-Control-Allow-Origin',origin);res.header('Vary','Origin');}
 res.header('Access-Control-Allow-Methods','GET, POST, PUT, DELETE, OPTIONS');
 res.header('Access-Control-Allow-Headers','Origin, Content-Type, Accept, Authorization');
 if(req.method==='OPTIONS')return res.sendStatus(origin&&!trustedOrigins.has(origin)?403:204);
 next();
});
app.get('/api/version',(_req,res)=>res.json({name:'MoroShow',version:'4.12.8',movies:iptvEnabled()?'IPTV':'TMDB',animation:iptvEnabled()?'IPTV':'TMDB genre 16',tv:'Unified directories + IPTV'}));
registerAccountAuth(app);
registerPublicTv(app);
registerIptvVod(app);
registerWebSources(app);
// Legacy TV and event endpoints remain disabled.
app.use(['/api/catalog','/api/events','/api/stream/proxy','/api/netshow','/api/tv'],(_req,res)=>res.status(410).json({success:false,error:'TV is temporarily disabled.'}));
app.get('/api/profiles', (_req: Request, res: Response) => {
  const profiles = db.getProfiles();
  res.json({ success: true, profiles });
});

app.post('/api/profiles', (req: Request, res: Response) => {
  const { name, avatar, isKid, pin } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Profile name is required' });
  }
  const newProfile = db.createProfile({
    name,
    avatar: avatar || 'disney_01',
    isKid: Boolean(isKid),
    pin: pin && pin.length === 4 ? pin : undefined
  });
  res.status(201).json({ success: true, profile: newProfile });
});

app.put('/api/profiles/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, avatar, isKid, pin } = req.body;
  const updated = db.updateProfile(id, { name, avatar, isKid, pin });
  if (!updated) return res.status(404).json({ success: false, error: 'Profile not found' });
  res.json({ success: true, profile: updated });
});

app.delete('/api/profiles/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const profiles = db.getProfiles();
  if (profiles.length <= 1) {
    return res.status(400).json({ success: false, error: 'Cannot delete the only remaining profile' });
  }
  const success = db.deleteProfile(id);
  res.json({ success });
});

app.post('/api/profiles/:id/verify-pin', (req: Request, res: Response) => {
  const { id } = req.params;
  const { pin } = req.body;
  if (!pin || typeof pin !== 'string') {
    return res.status(400).json({ success: false, error: 'PIN must be a 4-digit code' });
  }
  const result = db.verifyProfilePin(id, pin);
  if (!result.success) {
    return res.status(401).json({
      success: false,
      error: result.error,
      remainingAttempts: result.remainingAttempts,
      lockedSeconds: result.lockedSeconds
    });
  }
  res.json({ success: true });
});

// ==========================================
// 2. Watch History & Favorites APIs
// ==========================================

app.get('/api/profiles/:id/history', (req: Request, res: Response) => {
  const history = db.getWatchHistory(req.params.id);
  res.json({ success: true, history });
});

app.post('/api/profiles/:id/history', (req: Request, res: Response) => {
  const { id } = req.params;
  const { contentId, name, streamType, kind, category, posterUrl, currentTime, duration } = req.body;
  if (!contentId || currentTime === undefined) {
    return res.status(400).json({ success: false, error: 'Invalid history payload' });
  }
  const progressPercent = duration > 0 ? Math.min(100, Math.round((currentTime / duration) * 100)) : 0;
  db.saveWatchHistory(id, {
    contentId,
    name: name || 'Media',
    streamUrl: '',
    streamType: streamType || 'hls',
    kind: kind || 'movie',
    category: category || 'General',
    posterUrl,
    currentTime: Math.floor(currentTime),
    duration: Math.floor(duration || 0),
    progressPercent,
    updatedAt: Date.now()
  });
  res.json({ success: true });
});

app.get('/api/profiles/:id/favorites', (req: Request, res: Response) => {
  const favorites = db.getFavorites(req.params.id);
  res.json({ success: true, favorites });
});

app.post('/api/profiles/:id/favorites', (req: Request, res: Response) => {
  const { id } = req.params;
  const { contentId } = req.body;
  if (!contentId) return res.status(400).json({ success: false, error: 'contentId required' });
  db.addFavorite(id, contentId);
  res.json({ success: true });
});

app.delete('/api/profiles/:id/favorites/:contentId', (req: Request, res: Response) => {
  const { id, contentId } = req.params;
  db.removeFavorite(id, contentId);
  res.json({ success: true });
});


app.use('/api',(_req,res)=>res.status(404).json({success:false,error:'Endpoint not available in this version.'}));
async function start(){
 if(process.env.NODE_ENV==='production'){
  app.use(express.static('dist'));
  app.get('*',(_req,res)=>res.sendFile('dist/index.html',{root:'.'}));
 }else{
  const vite=await createViteServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);
 }
 app.listen(PORT,'0.0.0.0',()=>console.log(`[MoroShow] Ready on http://localhost:${PORT}`));
}
void start();

