import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
process.env.PORT='3115';process.env.NODE_ENV='production';
process.env.NETSHOW_ENABLE_LEGACY_IPTV='true';
process.env.IPTV_PLAYLIST_URL='https://tv.fixture.test/get.php?username=fixture&password=fixture&type=m3u_plus';
process.env.NETSHOW_ADDON_CRICIFY_URL='https://events.fixture.test/manifest.json';
const actualFetch=globalThis.fetch;const remoteRequests=[];
globalThis.fetch=async(input,options)=>{
 const u=new URL(String(input));if(u.hostname==='127.0.0.1')return actualFetch(input,options);
 remoteRequests.push(u.hostname+u.pathname);
 let body;
 if(u.hostname==='tv.fixture.test'){
  const action=u.searchParams.get('action');
  if(action?.endsWith('categories'))body=[{category_id:'1',category_name:'Sample'}];
  else if(action==='get_live_streams')body=[{stream_id:1,name:'TV sample',category_id:'1'}];
  else if(action==='get_vod_streams')body=[{stream_id:2,name:'Movie sample',category_id:'1',container_extension:'mp4'}];
  else if(action==='get_series')body=[{series_id:3,name:'Series sample',category_id:'1'}];
  else body={};
 }else if(u.hostname==='events.fixture.test'){
  if(u.pathname==='/manifest.json')body={catalogs:[{id:'events',type:'tv'}]};
  else if(u.pathname.startsWith('/catalog/'))body={metas:[{id:'fixture-event',name:'Event sample',type:'tv'}]};
  else if(u.pathname.startsWith('/stream/'))body={streams:[{url:'https://event-media.fixture.test/event.m3u8'}]};
  else body={};
 }else throw Error('Unexpected destination');
 return new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}});
};
await import('../server.ts');
const root='http://127.0.0.1:3115';let catalog;
for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,100));try{catalog=await(await actualFetch(root+'/api/catalog')).json();if(catalog.count>=4&&!catalog.loading)break;}catch{}}
assert.equal(catalog.movies.length,1);assert.equal(catalog.series.length,1);assert.equal(catalog.liveChannels.length,1);
const event=catalog.items.find(x=>x.category==='Cricify Events');assert.ok(event);
const profiles=await(await actualFetch(root+'/api/profiles')).json();const profile=profiles.profiles.find(x=>!x.isKid);
for(const item of [catalog.movies[0],event]){
 const r=await actualFetch(root+'/api/stream/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contentId:item.id,profileId:profile.id})});
 const token=await r.json();assert.equal(token.success,true);assert.ok(token.streamUrl.startsWith('/api/stream/proxy?'));
}
assert.ok(remoteRequests.every(x=>x.startsWith('tv.fixture.test')||x.startsWith('events.fixture.test')));
const report={passed:true,checks:['Xtream movies retained','Xtream series retained','Xtream TV retained','Cricify events retained after parallel loads','both token routes succeed','no other provider requested'],fixtureOnly:true};
writeFileSync('verification/routing-45.json',JSON.stringify(report,null,2));console.log(report);process.exit(0);
