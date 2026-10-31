import { spawn } from 'node:child_process';
import fs from 'node:fs';
const server=spawn(process.execPath,['--import','tsx','server.ts'],{env:{...process.env,NODE_ENV:'production',NODE_USE_ENV_PROXY:'1',PORT:'3307',IPTV_PLAYLIST_URL:'',NETSHOW_ENABLE_LEGACY_IPTV:'true'},stdio:['ignore','pipe','pipe']});
const timer=setTimeout(()=>server.kill(),110000);
try{
 await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(d.toString().includes('listening'))resolve();});server.on('exit',()=>reject(new Error('Server exited')));server.on('error',reject);});
 const base='http://127.0.0.1:3307';const profiles=await fetch(base+'/api/profiles').then(r=>r.json());const id=profiles.profiles.find(p=>!p.isKid&&!p.hasPin).id;
 const get=async path=>{const r=await fetch(base+path,{signal:AbortSignal.timeout(25000)});const d=await r.json();if(!d.success)throw new Error(d.error);return d;};
 const first=await get('/api/web-sources/anime?profileId='+id);console.log('anime',first.items.length);
 const second=await get('/api/web-sources/anime?profileId='+id+'&cursor='+first.nextCursor);console.log('page2',second.items.length,first.items[0].id!==second.items[0].id);
 const search=await get('/api/web-sources/anime?profileId='+id+'&q=naruto');console.log('search',search.items.map(i=>i.name));
 const ep=await get('/api/series/ani:spjuxray/episodes?profileId='+id);console.log('episodes',ep.episodes.length);
 const ep2=await get('/api/series/ani:spjuxray/episodes?profileId='+id+'&cursor='+ep.nextCursor);console.log('next episodes',ep2.episodes.length,ep2.episodes[0].episode);
 fs.mkdirSync('verification',{recursive:true});fs.writeFileSync('verification/sources-live.json',JSON.stringify({checkedAt:new Date().toISOString(),animeCount:first.items.length,page2Count:second.items.length,distinctPage2:first.items[0].id!==second.items[0].id,searchTitles:search.items.map(i=>i.name),episodes:ep.episodes.length,nextEpisodes:ep2.episodes.length,nextEpisodeNumber:ep2.episodes[0].episode,videoPlayback:'not verified',watch32:'missing user TMDB key',reezn:'not integrated'},null,2));
}finally{clearTimeout(timer);server.kill();}
