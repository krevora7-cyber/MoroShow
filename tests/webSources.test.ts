import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';
import {embedUrl,EMBED_SERVERS,kidsRating,clearSourceCache,registerWebSources} from '../src/server/webSources.ts';
import {parseDramaCatalog,parseDramaDetails,dramaEpisodeUrl} from '../src/server/dramaSource.ts';
import {db} from '../src/server/db.ts';
test('five ordered sources preserve selected movie and episode',()=>{assert.deepEqual(EMBED_SERVERS.map(x=>x.id),['vidstuck','videasy','cinesrc','cinezo','vidsrc-mov','vidlink','vidsrc-sh']);assert.equal(embedUrl('cinesrc','tv',42,2,3),'https://cinesrc.st/embed/tv/42?autoplay=true&autonext=false&s=2&e=3');assert.equal(embedUrl('cinezo','movie',42),'https://player.cinezo.live/embed/movie/42');assert.equal(embedUrl('vidsrc-mov','tv',42,2,3),'https://vidsrc.mov/embed/tv/42/2/3');assert.equal(embedUrl('vidlink','tv',42,2,3),'https://vidlink.pro/tv/42/2/3');assert.equal(embedUrl('vidsrc-sh','movie',42),'https://vidsrc.sh/embed/movie/42');assert.equal(embedUrl('vidstuck','tv',42,2,3),'https://vidstuck.cc/embed/tv/42/2/3?branding=MoroShow&color=ed2939');assert.equal(embedUrl('videasy','movie',42),'https://player.videasy.ws/embed/movie/42');for(const s of ['vidlink.it','https://bad.test'])assert.throws(()=>embedUrl(s,'movie',42));assert.throws(()=>embedUrl('cinezo','tv',42));});
test('Kids accepts only explicit safe US classifications and rejects conflicts',()=>{const d=(ratings:string[])=>({release_dates:{results:[{iso_3166_1:'US',release_dates:ratings.map(certification=>({certification}))}]}});assert.equal(kidsRating(d(['PG','']),'movie'),'PG');for(const r of [[],[''],['PG-13'],['PG','R'],['PG','unknown']])assert.equal(kidsRating(d(r),'movie'),undefined);assert.equal(kidsRating({...d(['G']),adult:true},'movie'),undefined);assert.equal(kidsRating({content_ratings:{results:[{iso_3166_1:'US',rating:'TV-Y7-FV'}]}},'tv'),'TV-Y7-FV');});
test('DramaTip parses actual card and episode identities without executing scripts',()=>{const h='<a href="/series/story"><img alt="Story" src="https://images.test/a.jpg?w=2048"/></a><a href="https://bad.test/series/false"><img alt="Bad"/></a>';const rows=parseDramaCatalog(h);assert.equal(rows.length,1);assert.equal(rows[0].id,'drama:story');assert.match(rows[0].logoUrl!,/w=500/);const d=parseDramaDetails('<h1>Story</h1><a data-serial="2" href="/series/story/episode-2">2</a><a data-serial="1" href="/series/story/episode-1">1</a>','story');assert.deepEqual(d.episodes.map(e=>e.id),['drama:story:1','drama:story:2']);assert.equal(dramaEpisodeUrl('drama:story:2'),'https://dramatip.net/series/story/episode-2');assert.throws(()=>dramaEpisodeUrl('drama:../../secret:1'));});
test('HTTP routes filter kids, combine animation, load one season and reject unavailable episodes',async()=>{
 const real=globalThis.fetch,old=process.env.TMDB_API_KEY;process.env.TMDB_API_KEY='fixture';clearSourceCache();const paths:string[]=[];
 globalThis.fetch=(async(input:any,init:any)=>{const u=new URL(String(input));if(u.hostname!=='api.themoviedb.org')return real(input,init);paths.push(u.pathname);let d:any;const tv=u.pathname.includes('/tv');if(/\/popular$|\/discover\/|\/search\//.test(u.pathname))d={results:[{id:1,title:'Safe',name:'Safe',genre_ids:[16]},{id:2,title:'Unsafe',name:'Unsafe',genre_ids:[16]},{id:3,title:'Other',name:'Other',genre_ids:[28]}],total_pages:2};else if(/\/season\//.test(u.pathname))d={episodes:[{name:'Released',season_number:2,episode_number:3,air_date:'2020-01-01'},{name:'Future',season_number:2,episode_number:4,air_date:'2099-01-01'}]};else{const id=Number(u.pathname.split('/').pop());d={id,title:'Title',name:'Title',genres:[{id:16}],seasons:[{season_number:1},{season_number:2}],videos:{results:[]},release_dates:{results:[{iso_3166_1:'US',release_dates:[{certification:id===1?'PG':'PG-13'}]}]},content_ratings:{results:[{iso_3166_1:'US',rating:id===1?'TV-Y7':'TV-14'}]}};}return new Response(JSON.stringify(d));}) as typeof fetch;
 const app=express();app.use(express.json());registerWebSources(app);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as any).port}`,adult=db.getProfiles().find(p=>!p.isKid)!,kid=db.createProfile({name:'Kids test fixture',avatar:'disney_01',isKid:true});
 const get=(p:string)=>real(base+p).then(r=>r.json()),post=(id:string,profileId=kid.id)=>real(base+'/api/stream/token',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contentId:id,profileId,variantId:'cinesrc'})}).then(r=>r.json());
 try{let d=await get(`/api/web-sources/catalog?type=animation&profileId=${adult.id}`);assert.equal(d.items.length,4);assert.ok(d.items.every((i:any)=>i.genreIds.includes(16)));d=await get(`/api/web-sources/catalog?type=animation&profileId=${kid.id}`);assert.equal(d.items.length,2);assert.ok(d.items.every((i:any)=>i.kidsVerified));d=await get(`/api/web-sources/catalog?type=search&q=Title&profileId=${kid.id}`);assert.equal(d.items.length,2);assert.equal((await post('w32:movie:2')).success,false);assert.equal((await post('w32:movie:1')).embedUrl,'https://cinesrc.st/embed/movie/1?autoplay=true&autonext=false');d=await get(`/api/series/w32:tv:1/episodes?season=2&profileId=${kid.id}`);assert.deepEqual(d.seasons,[1,2]);assert.equal(d.episodes.length,1);assert.ok(!paths.some(p=>p.endsWith('/season/1')));assert.equal((await post('w32:tv:1:2:4')).success,false);assert.equal((await post('w32:tv:1:2:3')).embedUrl,'https://cinesrc.st/embed/tv/1?autoplay=true&autonext=false&s=2&e=3');assert.equal((await get('/api/web-sources/catalog')).success,false);assert.equal((await get(`/api/web-sources/clips?profileId=${kid.id}`)).items.length,0);assert.equal((await post('ani:old:1',adult.id)).success,false);}finally{db.deleteProfile(kid.id);globalThis.fetch=real;if(old)process.env.TMDB_API_KEY=old;else delete process.env.TMDB_API_KEY;clearSourceCache();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});

test('direct playback returns only configured sources for the requested title and player version', async () => {
  const originalFetch = globalThis.fetch;
  const oldKey = process.env.TMDB_API_KEY;
  const oldCatalog = process.env.MOROSHOW_NATIVE_HLS_CATALOG;
  const oldPlaybackMode = process.env.MOROSHOW_MOVIE_PLAYBACK;
  process.env.TMDB_API_KEY = 'fixture';
  delete process.env.MOROSHOW_MOVIE_PLAYBACK;
  process.env.MOROSHOW_NATIVE_HLS_CATALOG = JSON.stringify({
    'w32:tv:42:1:1': [
      {id:'native-1',label:'MP4',streamUrl:'https://media.example.invalid/42-1.mp4',streamType:'mp4'},
      {id:'native-2',label:'HLS',streamUrl:'https://media.example.invalid/42-1.m3u8'},
    ],
    'w32:tv:42:1:2': [
      {id:'native-1',label:'MP4',streamUrl:'https://media.example.invalid/42-2.mp4',streamType:'mp4'},
    ],
    'w32:movie:42': [1, 2, 3, 4, 5].map(number => ({
      id:`native-${number}`, label:`Backup ${number}`, streamUrl:`https://media.example.invalid/${number}/42.m3u8`,
    })),
  });
  clearSourceCache();
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname !== 'api.themoviedb.org') return originalFetch(input, init);
    const episodes = [1, 2, 3].map(episode_number => ({episode_number, air_date:'2020-01-01'}));
    return Response.json(url.pathname.endsWith('/season/1') ? {episodes} : {id:42, name:'Test series'});
  };
  const app = express();
  app.use(express.json());
  registerWebSources(app);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const adult = db.getProfiles().find(profile => !profile.isKid)!;
  const post = (body: Record<string, unknown>, port = address.port) => originalFetch(
    `http://127.0.0.1:${port}/api/stream/token`,
    {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({
      contentId:'w32:tv:42:1:1', profileId:adult.id, ...body,
    })},
  ).then(response => response.json());
  try {
    const newPlayer = {nativePlayback:true, nativePlaybackVersion:2};
    const result = await post(newPlayer);
    assert.equal(result.streamUrl, 'https://media.example.invalid/42-1.mp4');
    assert.equal(result.embedUrl, undefined);
    assert.deepEqual(result.episodes.map((episode: {number:number}) => episode.number), [1, 2]);
    assert.equal((await post({...newPlayer, variantId:'native-2'})).streamType, 'hls');
    assert.deepEqual((await post({nativePlayback:true})).variants, [{id:'native-2',label:'Source 1',kind:'direct'}]);
    const missing = await post({...newPlayer, contentId:'w32:tv:42:1:3'});
    assert.equal(missing.streamUrl, '');
    assert.equal(missing.embedUrl, undefined);
    assert.deepEqual(missing.variants, []);
    const withFallback = {...newPlayer, allowEmbedFallback:true};
    const primary = await post(withFallback);
    assert.equal(primary.variantId, 'cinesrc');
    assert.match(primary.embedUrl, /autoplay=true/);
    assert.equal(primary.variants[0].label, 'Source 1');
    const direct = await post({...withFallback, variantId:'native-1'});
    assert.equal(direct.streamType, 'mp4');
    assert.equal(direct.embedUrl, undefined);
    assert.deepEqual(direct.variants.map((source: {id:string}) => source.id), primary.variants.map((source: {id:string}) => source.id));
    const primaryEmbed = 'https://cinesrc.st/embed/tv/42?autoplay=true&autonext=false&s=1&e=3';
    for (const variantId of ['vidstuck','videasy','vidlink','native-1']) {
      const fallback = await post({...withFallback, contentId:'w32:tv:42:1:3', variantId});
      assert.equal(fallback.streamUrl, '');
      assert.equal(fallback.embedUrl, primaryEmbed);
      assert.equal(fallback.variantId, 'cinesrc');
      assert.deepEqual(fallback.variants, [{id:'cinesrc',label:'Source 1',kind:'embed'}]);
    }
    const legacy = await post({contentId:'w32:tv:42:1:3', variantId:'vidlink'});
    assert.equal(legacy.embedUrl, primaryEmbed);
    assert.deepEqual(primary.variants.map((source: {label:string}) => source.label), ['Source 1','Source 2','Source 3']);
    assert.match((await post({})).embedUrl, /^https:\/\/cinesrc\.st\/embed\//);

    process.env.MOROSHOW_MOVIE_PLAYBACK = 'direct-only';
    const cleanApp = express();
    cleanApp.use(express.json());
    registerWebSources(cleanApp);
    const cleanServer = cleanApp.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => cleanServer.once('listening', resolve));
    try {
      const cleanAddress = cleanServer.address();
      assert.ok(cleanAddress && typeof cleanAddress !== 'string');
      const play = (body: Record<string, unknown>) => post({...withFallback, ...body}, cleanAddress.port);
      const movie = await play({contentId:'w32:movie:42'});
      assert.equal(movie.playbackMode, 'direct-only');
      assert.equal(movie.variantId, 'native-1');
      assert.equal(movie.embedUrl, undefined);
      assert.deepEqual(movie.variants.map((source: {label:string}) => source.label), ['Source 1','Source 2','Source 3','Source 4']);
      for (const number of [1, 2, 3, 4]) {
        const source = await play({contentId:'w32:movie:42', variantId:`native-${number}`});
        assert.equal(source.streamUrl, `https://media.example.invalid/${number}/42.m3u8`);
        assert.equal(source.embedUrl, undefined);
      }
      const episode = await play({variantId:'native-2'});
      assert.equal(episode.streamUrl, 'https://media.example.invalid/42-1.m3u8');
      const uncovered = await play({contentId:'w32:tv:42:1:3'});
      assert.equal(uncovered.embedUrl, undefined);
      assert.deepEqual(uncovered.variants, []);
    } finally {
      cleanServer.closeAllConnections();
      await new Promise<void>(resolve => cleanServer.close(() => resolve()));
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (oldKey === undefined) delete process.env.TMDB_API_KEY;
    else process.env.TMDB_API_KEY = oldKey;
    if (oldCatalog === undefined) delete process.env.MOROSHOW_NATIVE_HLS_CATALOG;
    else process.env.MOROSHOW_NATIVE_HLS_CATALOG = oldCatalog;
    if (oldPlaybackMode === undefined) delete process.env.MOROSHOW_MOVIE_PLAYBACK;
    else process.env.MOROSHOW_MOVIE_PLAYBACK = oldPlaybackMode;
    clearSourceCache();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
