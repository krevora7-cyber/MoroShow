import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {nuvioVod} from '../src/server/nuvioVod';
import {addonVod,directAddonStream} from '../src/server/stremioVod';
import {readEmbedProgress} from '../src/player/embedEvents';
import {embedStartUrl} from '../src/player/embedPresentation';
import {matchingSubtitle} from '../src/player/subtitlePreferences';

test('the installed Nuvio bundle receives exact movie or episode arguments',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'moroshow-plugin-'));
 const original=process.env.MOROSHOW_VIXSRC_PLUGIN;
 try {
  const bundle=path.join(dir,'vixsrc.cjs');
  await writeFile(bundle,`exports.getStreams=async (id,type,s,e)=>[{url:'https://media.example/'+[id,type,s,e].join('-')+'.m3u8'}];`);
  process.env.MOROSHOW_VIXSRC_PLUGIN=bundle;
  assert.equal((await nuvioVod('vixsrc',{id:42,type:'tv',season:2,episode:3}))?.streamUrl,'https://media.example/42-tv-2-3.m3u8');
  assert.equal((await nuvioVod('vixsrc',{id:42,type:'movie'}))?.streamUrl,'https://media.example/42-movie--.m3u8');
  await writeFile(bundle,'throw Error("offline")');
  assert.equal(await nuvioVod('vixsrc',{id:42,type:'movie'}),undefined);
 } finally {
  if(original===undefined)delete process.env.MOROSHOW_VIXSRC_PLUGIN;else process.env.MOROSHOW_VIXSRC_PLUGIN=original;
  await rm(dir,{recursive:true,force:true});
 }
});

test('HTTP addon uses IMDb episode identity and accepts only playable links and VTT language tracks',async t=>{
 let endpoint='';
 t.mock.method(globalThis,'fetch',async(input:URL)=>{
  endpoint=input.href;
  return Response.json({streams:[{url:'https://invalid.test/a.mp4',headers:{Referer:'required'}},{url:'https://cdn.test/a.mp4',subtitles:[
   {url:'https://cdn.test/ar.vtt',lang:'ara'},{url:'https://cdn.test/ar.vtt',lang:'ara'},{url:'https://cdn.test/b.vtt',lang:'<img>'}
  ]}]});
 });
 const result=await addonVod(new URL('https://addon.test/config/manifest.json'),'tt12345',2,7);
 assert.equal(endpoint,'https://addon.test/config/stream/series/tt12345:2:7.json');
 assert.equal(result?.streamUrl,'https://cdn.test/a.mp4');
 assert.deepEqual(result?.subtitles,[{url:'https://cdn.test/ar.vtt',lang:'ara',label:'ara'}]);
 assert.equal(directAddonStream([{url:'http://cdn.test/a.m3u8'},{url:'https://cdn.test/embed'}]),undefined);
 assert.equal(matchingSubtitle('ar',[{lang:'ara'}]),'ara');
});

test('resume URLs and trusted movie/episode events preserve the intended position',()=>{
 for(const host of ['vidlink.pro','vixsrc.to'])assert.equal(new URL(embedStartUrl('https://'+host+'/tv/42/2/7',83.5)).searchParams.get('startAt'),'83');
 const origin='https://vixsrc.to',id='w32:tv:42:2:7';
 const msg={type:'PLAYER_EVENT',data:{event:'pause',video_id:21,currentTime:84,duration:150}};
 assert.equal(readEmbedProgress(origin,msg,origin,id)?.time,84);
 assert.equal(readEmbedProgress('https://elsewhere.test',msg,origin,id),null);
 assert.equal(readEmbedProgress(origin,{...msg,data:{...msg.data,duration:Infinity}},origin,id),null);
 const vid='https://vidlink.pro', event={type:'PLAYER_EVENT',data:{...msg.data,tmdbId:42,mediaType:'tv',season:2,episode:7}};
 assert.equal(readEmbedProgress(vid,event,vid,id)?.time,84);
 assert.equal(readEmbedProgress(vid,event,vid,'w32:tv:42:2:8'),null);
});
