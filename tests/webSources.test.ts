import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';
import {embedUrl,EMBED_SERVERS,kidsRating,clearSourceCache,registerWebSources} from '../src/server/webSources.ts';
import {parseDramaCatalog,parseDramaDetails,dramaEpisodeUrl} from '../src/server/dramaSource.ts';
import {db} from '../src/server/db.ts';
test('provider URLs preserve selected movie and episode',()=>{assert.deepEqual(EMBED_SERVERS.map(x=>x.id),['vidstuck','videasy','cinesrc','cinezo','vidsrc-mov','vidlink','vidsrc-sh']);assert.equal(embedUrl('cinesrc','tv',42,2,3),'https://cinesrc.st/embed/tv/42?autoplay=false&autonext=false&s=2&e=3');assert.equal(embedUrl('cinezo','movie',42),'https://player.cinezo.live/embed/movie/42');assert.equal(embedUrl('vidsrc-mov','tv',42,2,3),'https://vidsrc.mov/embed/tv/42/2/3');assert.equal(embedUrl('vidlink','tv',42,2,3),'https://vidlink.pro/tv/42/2/3');assert.equal(embedUrl('vidsrc-sh','movie',42),'https://vidsrc.sh/embed/movie/42');assert.equal(embedUrl('vidstuck','tv',42,2,3),'https://vidstuck.cc/embed/tv/42/2/3?branding=MoroShow&color=ed2939');assert.equal(embedUrl('videasy','movie',42),'https://player.videasy.ws/embed/movie/42');for(const s of ['vidlink.it','https://bad.test'])assert.throws(()=>embedUrl(s,'movie',42));assert.throws(()=>embedUrl('cinezo','tv',42));});
test('Kids accepts only explicit safe US classifications and rejects conflicts',()=>{const d=(ratings:string[])=>({release_dates:{results:[{iso_3166_1:'US',release_dates:ratings.map(certification=>({certification}))}]}});assert.equal(kidsRating(d(['PG','']),'movie'),'PG');for(const r of [[],[''],['PG-13'],['PG','R'],['PG','unknown']])assert.equal(kidsRating(d(r),'movie'),undefined);assert.equal(kidsRating({...d(['G']),adult:true},'movie'),undefined);assert.equal(kidsRating({content_ratings:{results:[{iso_3166_1:'US',rating:'TV-Y7-FV'}]}},'tv'),'TV-Y7-FV');});
test('DramaTip parses actual card and episode identities without executing scripts',()=>{const h='<a href="/series/story"><img alt="Story" src="https://images.test/a.jpg?w=2048"/></a><a href="https://bad.test/series/false"><img alt="Bad"/></a>';const rows=parseDramaCatalog(h);assert.equal(rows.length,1);assert.equal(rows[0].id,'drama:story');assert.match(rows[0].logoUrl!,/w=500/);const d=parseDramaDetails('<h1>Story</h1><a data-serial="2" href="/series/story/episode-2">2</a><a data-serial="1" href="/series/story/episode-1">1</a>','story');assert.deepEqual(d.episodes.map(e=>e.id),['drama:story:1','drama:story:2']);assert.equal(dramaEpisodeUrl('drama:story:2'),'https://dramatip.net/series/story/episode-2');assert.throws(()=>dramaEpisodeUrl('drama:../../secret:1'));});
test('HTTP routes filter kids, combine animation, load one season and reject unavailable episodes',async()=>{
 const real=globalThis.fetch,old=process.env.TMDB_API_KEY;process.env.TMDB_API_KEY='fixture';clearSourceCache();const paths:string[]=[];
 const providerEnv = {
   MOROSHOW_MOVIEBOX_URL: 'https://moviebox.test',
   MOROSHOW_MOVIEBOX_SECRET: 'fixture-secret',
   MOROSHOW_CINEPRO_URL: 'https://cinepro.test',
   MOROSHOW_ICEFY_URL: 'https://icefy.test',
 };
 const priorEnv = Object.fromEntries(Object.keys(providerEnv).map(key => [key, process.env[key]]));
 const providerRequests: string[] = [];
 const movieBoxKeywords: string[] = [];
 const reply = (data: object) => Response.json(data);
 globalThis.fetch=(async(input:any,init:any)=>{const u=new URL(String(input));
 if (u.hostname === 'moviebox.test') {
   providerRequests.push(u.pathname + u.search);
   assert.equal(new Headers(init.headers).get('X-Worker-Secret'), 'fixture-secret');
   if (u.pathname === '/search') {
     const {keyword} = JSON.parse(init.body);
     movieBoxKeywords.push(keyword);
     if (movieBoxKeywords.length === 1) return new Response(null,{status:503});
     return reply({items:[
       {type:'movie', title:'Title', releaseDate:'1999-01-01', subjectId:'111'},
       ...(keyword === 'Original Title'
         ? [{type:'movie', title:'Original Title', releaseDate:'2024-01-01', subjectId:'222'}]
         : []),
     ]});
   }
   assert.equal(u.pathname + u.search, '/stream/222?se=0&ep=0');
   return reply({streams:[
     {url:'https://cdn.test/1080.mp4', format:'mp4', codecName:'hevc', resolution:1080},
     {url:'https://cdn.test/720.mp4?signature=fixture', format:'mp4', codecName:'h264', resolution:720},
   ]});
 }
 if (u.hostname === 'cinepro.test') {
   providerRequests.push(u.pathname);
   return reply({sources:[
     {url:'https://cdn.test/player', type:'embed'},
     {url:'https://cdn.test/episode.m3u8', type:'hls'},
   ]});
 }
 if (u.hostname === 'icefy.test') {
   providerRequests.push(u.pathname);
   return u.pathname.startsWith('/tv/')
     ? reply({stream:'https://cdn.test/icefy.m3u8'})
     : new Response('challenge', {status:403});
 }
 if(u.hostname!=='api.themoviedb.org')return real(input,init);paths.push(u.pathname);let d:any;const tv=u.pathname.includes('/tv');if(/\/person\/\d+\/combined_credits$/.test(u.pathname))d={cast:[{id:1,media_type:'movie',title:'Current',popularity:100},{id:2,media_type:'movie',title:'Other',popularity:50},{id:2,media_type:'movie',title:'Duplicate',popularity:40},{id:3,media_type:'tv',name:'Series',popularity:30},{id:4,media_type:'movie',title:'Adult',adult:true,popularity:20},{id:5,media_type:'tv',name:'Talk',character:'Self',genre_ids:[10767],popularity:80}]};else if(/\/popular$|\/discover\/|\/search\//.test(u.pathname))d={results:[{id:1,title:'Safe',name:'Safe',genre_ids:[16]},{id:2,title:'Unsafe',name:'Unsafe',genre_ids:[16]},{id:3,title:'Other',name:'Other',genre_ids:[28]}],total_pages:2};else if(/\/season\//.test(u.pathname))d={episodes:[{name:'Released',season_number:2,episode_number:3,air_date:'2020-01-01'},{name:'Future',season_number:2,episode_number:4,air_date:'2099-01-01'}]};else{const id=Number(u.pathname.split('/').pop());d={id,title:'Title',original_title:'Original Title',name:'Title',release_date:'2024-01-01',genres:[{id:16}],seasons:[{season_number:1},{season_number:2}],videos:{results:[]},release_dates:{results:[{iso_3166_1:'US',release_dates:[{certification:id===1?'PG':'PG-13'}]}]},content_ratings:{results:[{iso_3166_1:'US',rating:id===1?'TV-Y7':'TV-14'}]}};}return new Response(JSON.stringify(d));}) as typeof fetch;
 const app=express();app.use(express.json());registerWebSources(app);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as any).port}`,adult=db.getProfiles().find(p=>!p.isKid)!,kid=db.createProfile({name:'Kids test fixture',avatar:'disney_01',isKid:true});
 const get=(p:string)=>real(base+p).then(r=>r.json()),post=(id:string,profileId=kid.id,variantId='cinesrc',directVod=false)=>real(base+'/api/stream/token',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contentId:id,profileId,variantId,directVod})}).then(r=>r.json());
 try{let d=await get(`/api/people/123/credits?profileId=${adult.id}&exclude=w32:movie:1`);assert.deepEqual(d.items.map((i:any)=>i.id),['w32:movie:2','w32:tv:3']);for(const variant of ['vidstuck','videasy','cinesrc','vidlink']){const result=await post('w32:movie:1',adult.id,variant);assert.equal(result.success,true);assert.equal(result.variantId,variant);assert.equal(result.variants.length,4);assert.ok(result.embedUrl.startsWith('https://'));}d=await get(`/api/web-sources/catalog?type=animation&profileId=${adult.id}`);assert.equal(d.items.length,4);assert.ok(d.items.every((i:any)=>i.genreIds.includes(16)));d=await get(`/api/web-sources/catalog?type=animation&profileId=${kid.id}`);assert.equal(d.items.length,2);assert.ok(d.items.every((i:any)=>i.kidsVerified));d=await get(`/api/web-sources/catalog?type=search&q=Title&profileId=${kid.id}`);assert.equal(d.items.length,2);assert.equal((await post('w32:movie:2')).success,false);assert.equal((await post('w32:movie:1')).embedUrl,'https://cinesrc.st/embed/movie/1?autoplay=false&autonext=false');d=await get(`/api/series/w32:tv:1/episodes?season=2&profileId=${kid.id}`);assert.deepEqual(d.seasons,[1,2]);assert.equal(d.episodes.length,1);assert.ok(!paths.some(p=>p.endsWith('/season/1')));assert.equal((await post('w32:tv:1:2:4')).success,false);assert.equal((await post('w32:tv:1:2:3')).embedUrl,'https://cinesrc.st/embed/tv/1?autoplay=false&autonext=false&s=2&e=3');assert.equal((await get('/api/web-sources/catalog')).success,false);assert.equal((await get(`/api/web-sources/clips?profileId=${kid.id}`)).items.length,0);assert.equal((await post('ani:old:1',adult.id)).success,false);
  Object.assign(process.env, providerEnv);
  assert.equal((await post('w32:movie:1',adult.id,'moviebox')).success,false);
  assert.equal((await post('w32:movie:2',kid.id,'moviebox',true)).success,false);
  assert.equal((await post('w32:tv:1:2:4',adult.id,'cinepro',true)).success,false);
  assert.equal(providerRequests.length,0);
  const movie = await post('w32:movie:1',adult.id,'moviebox',true);
  assert.deepEqual(movieBoxKeywords,['Title','Title','Original Title']);
  assert.equal(movie.streamType,'mp4');
  assert.equal(movie.streamUrl,'https://cdn.test/720.mp4?signature=fixture');
  assert.equal(movie.embedUrl,undefined);
  const episode = await post('w32:tv:1:2:3',adult.id,'cinepro',true);
  assert.equal(episode.streamType,'hls');
  assert.equal(episode.streamUrl,'https://cdn.test/episode.m3u8');
  assert.ok(providerRequests.includes('/v1/tv/1/seasons/2/episodes/3'));
  const icefy = await post('w32:tv:1:2:3',adult.id,'icefy',true);
  assert.equal(icefy.streamType,'hls');
  assert.equal(icefy.streamUrl,'https://cdn.test/icefy.m3u8');
  assert.ok(providerRequests.includes('/tv/1/2/3'));
  assert.equal((await post('w32:movie:1',adult.id,'icefy',true)).success,false);
  assert.ok((await post('w32:movie:1',adult.id)).embedUrl);
 }finally{
  for (const [key,value] of Object.entries(priorEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
db.deleteProfile(kid.id);globalThis.fetch=real;if(old)process.env.TMDB_API_KEY=old;else delete process.env.TMDB_API_KEY;clearSourceCache();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
