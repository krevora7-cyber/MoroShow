import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {httpJsonProvider} from '../src/server/httpJsonProvider.ts';
import {loadBrowserProviders,browserEpisodes,browserPlayback} from '../src/server/chromeProviderEngine.ts';
import {fnv1a64} from '../src/utils/fnv1a64.ts';
import {consolidationKey} from '../src/utils/groupCatalog.ts';

test('end-to-end HTTP provider in a real local server: catalog + episodes + playback',async()=>{
 const calls=[];
 const server=http.createServer((req,res)=>{
   calls.push(req.url);res.setHeader('content-type','application/json');
   if(req.url==='/catalog')return res.end(JSON.stringify([
     {externalId:'permitted-show',name:'Authorized Series',kind:'series',section:'series',poster:'https://img.example.com/poster.jpg'},
     {externalId:'permitted-live',name:'Authorized Channel',kind:'live',section:'live'}
   ]));
   if(req.url==='/series/permitted-show/episodes')return res.end(JSON.stringify([
     {externalId:'episode-one',name:'Episode 1',kind:'series',section:'series',seriesName:'Authorized Series',season:1,episode:1}
   ]));
   if(req.url==='/stream/episode-one')return res.end(JSON.stringify([{url:'https://cdn.example.org/ep1.m3u8'}]));
   if(req.url==='/stream/permitted-live')return res.end(JSON.stringify([{url:'https://cdn.example.org/live.m3u8'}]));
   res.statusCode=404;res.end('{}');
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 try{
   const base=`http://127.0.0.1:${server.address().port}`;
   const result=await loadBrowserProviders([httpJsonProvider('yacintv',base)]);
   assert.equal(result.items.length,1); // yacintv restricted to live even when upstream returns series
   assert.equal(result.items[0].item.name,'Authorized Channel');
   const id=`ns-g-${fnv1a64(consolidationKey(result.items[0].item))}`;
   assert.equal((await browserPlayback(id)).url,'https://cdn.example.org/live.m3u8');
   const series=await loadBrowserProviders([httpJsonProvider('streamplay',base)]);
   assert.equal(series.items.length,1);
   const showId=`ns-g-${fnv1a64(consolidationKey(series.items[0].item))}`;
   const episodes=await browserEpisodes(showId);assert.equal(episodes.length,1);
   const episodeId=`ns-g-${fnv1a64(consolidationKey(episodes[0].item))}`;
   assert.equal((await browserPlayback(episodeId)).url,'https://cdn.example.org/ep1.m3u8');
   assert.ok(calls.includes('/catalog')&&calls.includes('/stream/episode-one'));
 }finally{server.close();}
});
