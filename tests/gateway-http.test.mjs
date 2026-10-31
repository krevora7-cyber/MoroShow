import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {loadGateway,resolveGatewayStream,loadGatewayEpisodes} from '../src/server/addonGateway.ts';
import {fnv1a64} from '../src/utils/fnv1a64.ts';
import {consolidationKey} from '../src/utils/groupCatalog.ts';
test('real HTTP: manifest -> catalog -> movie stream + series episodes', async()=>{
 const server=createServer((req,res)=>{
  res.setHeader('Content-Type','application/json');
  const p=req.url;
  if(p==='/manifest.json')res.end(JSON.stringify({catalogs:[{type:'movie',id:'movies'},{type:'series',id:'shows'}]}));
  else if(p?.includes('/catalog/movie/'))res.end(JSON.stringify({metas:[{id:'movie-1',name:'Authorized Sample Film',poster:'https://images.example.org/poster.jpg'}]}));
  else if(p?.includes('/catalog/series/'))res.end(JSON.stringify({metas:[{id:'series-1',name:'Authorized Sample Show'}]}));
  else if(p?.includes('/meta/series/'))res.end(JSON.stringify({meta:{videos:[{id:'s01e01',season:1,episode:1}]}}));
  else if(p?.includes('/stream/'))res.end(JSON.stringify({streams:[{url:'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'}]}));
  else{res.statusCode=404;res.end('{}');}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const base=`http://127.0.0.1:${server.address().port}`;
  const {items,status}=await loadGateway(fetch,{NETSHOW_ADDON_BRIDGE_URL:base+'/manifest.json'});
  assert.equal(status.find(s=>s.source==='bridge').status,'connected');
  assert.equal(items.length,2);
  const movie=items.find(m=>m.item.kind==='movie');
  const movieId=`ns-g-${fnv1a64(consolidationKey(movie.item))}`;
  const stream=await resolveGatewayStream(movieId);
  assert.equal(stream.kind,'hls');
  const show=items.find(m=>m.item.kind==='series');
  const showId=`ns-g-${fnv1a64(consolidationKey(show.item))}`;
  const episodes=await loadGatewayEpisodes(showId);
  assert.equal(episodes[0].item.episode,1);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
