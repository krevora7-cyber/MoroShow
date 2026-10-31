import {spawn} from 'node:child_process';
import fs from 'node:fs';
const server=spawn(process.execPath,['--import','tsx','server.ts'],{env:{...process.env,NODE_ENV:'production',NODE_USE_ENV_PROXY:'1',PORT:'3308',IPTV_PLAYLIST_URL:'',NETSHOW_ENABLE_LEGACY_IPTV:'true'},stdio:['ignore','pipe','pipe']});
const timeout=setTimeout(()=>server.kill(),90000);
try{
 await new Promise((ok,bad)=>{server.stdout.on('data',d=>{if(d.toString().includes('listening'))ok();});server.on('exit',()=>bad(new Error('Test server exited')));server.on('error',bad);server.stderr.on('data',()=>{});});
 const base='http://127.0.0.1:3308';
 const get=async(path)=>{const r=await fetch(base+path,{signal:AbortSignal.timeout(30000)});const d=await r.json();if(!r.ok||!d.success)throw new Error(d.error||`HTTP ${r.status}`);return d;};
 const profiles=await get('/api/profiles');const id=profiles.profiles.find(p=>!p.isKid&&!p.hasPin).id;
 const [movies,series]=await Promise.all(['movie','tv'].map(type=>get(`/api/web-sources/catalog?type=${type}&profileId=${id}`)));
 const movie=movies.items[0];
 const [art,episodes]=await Promise.all([get(`/api/media/${encodeURIComponent(movie.id)}/artwork`),get(`/api/series/w32:tv:1396/episodes?profileId=${id}`)]);
 const report={checkedAt:new Date().toISOString(),movies:movies.items.length,series:series.items.length,moviePoster:!!art.posterUrl,backdrop:!!art.backdropUrl,trailer:!!art.trailerId,seriesEpisodes:episodes.episodes.length,firstEpisode:episodes.episodes[0]?.id,videoPlayback:'not tested',reezn:'pending'};
 console.log(JSON.stringify(report));fs.writeFileSync('verification/tmdb-configured.json',JSON.stringify(report,null,2));
}finally{clearTimeout(timeout);server.kill();}
