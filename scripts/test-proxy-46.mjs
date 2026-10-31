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
writeFileSync('verification/routing-45.json',JSON.stringify(report,null,2));console.log(report);

// Exercise the real HTTP proxy route with deterministic upstream responses.
const http = (await import('node:http')).default;
const https = (await import('node:https')).default;
const { PassThrough } = await import('node:stream');
const { EventEmitter } = await import('node:events');
const { generatePlaybackToken, verifyPlaybackToken } = await import('../src/utils/security.ts');
const requests=[];
const fakeGet=(url,options,callback)=>{
 const u=new URL(url);requests.push({url:String(url),headers:options.headers});
 const request=new EventEmitter();request.setTimeout=()=>request;request.destroy=()=>{};
 queueMicrotask(()=>{
  const response=new PassThrough();response.statusCode=200;response.headers={};
  let body='segment-data';
  if(u.pathname==='/start'){response.statusCode=302;response.headers.location='https://cdn.fixture.test/path/list.m3u8';body='';}
  else if(u.pathname==='/path/list.m3u8'){response.headers['content-type']='application/vnd.apple.mpegurl';body='#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\npart.ts\n';}
  else if(u.pathname==='/loop'){response.statusCode=302;response.headers.location='/loop';body='';}
  else if(u.pathname==='/blocked'){response.statusCode=302;response.headers.location='http://127.0.0.1/private';body='';}
  else if(u.pathname==='/down'){response.statusCode=503;body='';}
  else if(u.pathname==='/caption'){response.statusCode=302;response.headers.location='/captions.srt';body='';}
  else if(u.pathname==='/captions.srt'){body='1\n00:00:01,000 --> 00:00:02,000\nHello\n';}
  else if(u.pathname==='/movie.mp4'){response.statusCode=206;response.headers={'content-type':'video/mp4','content-range':'bytes 0-3/12','accept-ranges':'bytes'};body='data';}
  callback(response);response.end(body);
 });return request;
};
http.get=fakeGet;https.get=fakeGet;
const pathFor=(path,subtitle=false)=>'/api/stream/proxy?'+(subtitle?'subtitle=1&':'')+'token='+encodeURIComponent(generatePlaybackToken({contentId:catalog.movies[0].id,profileId:profile.id,streamUrl:'https://tv.fixture.test'+path,streamType:'hls',isKidProfile:false,streamHeaders:{authorization:'fixture-secret','user-agent':'fixture-agent'}}));
let response=await actualFetch(root+pathFor('/start'),{redirect:'manual'});
assert.equal(response.status,200);const manifest=await response.text();
assert.ok(manifest.startsWith('#EXTM3U'));assert.ok(!manifest.includes('https://cdn'));
const segmentPath=manifest.trim().split('\n').at(-1);
const segmentPayload=verifyPlaybackToken(new URL(root+segmentPath).searchParams.get('token')).payload;
assert.equal(segmentPayload.streamUrl,'https://cdn.fixture.test/path/part.ts');
assert.equal(segmentPayload.streamHeaders?.authorization,undefined);
assert.equal(requests.find(x=>x.url.includes('cdn.fixture')).headers.authorization,undefined);
response=await actualFetch(root+segmentPath);assert.equal(await response.text(),'segment-data');
response=await actualFetch(root+pathFor('/movie.mp4'),{headers:{range:'bytes=0-3'}});assert.equal(response.status,206);assert.equal(response.headers.get('content-range'),'bytes 0-3/12');assert.equal(await response.text(),'data');assert.equal(requests.at(-1).headers.Range,'bytes=0-3');
response=await actualFetch(root+pathFor('/caption',true));assert.match(await response.text(),/^WEBVTT/);
let before=requests.length;response=await actualFetch(root+pathFor('/down'));assert.equal(response.status,502);assert.equal(requests.length-before,1);
response=await actualFetch(root+pathFor('/loop'));assert.equal(response.status,502);
before=requests.length;response=await actualFetch(root+pathFor('/blocked'));assert.equal(response.status,400);assert.equal(requests.length-before,1);
const proxyReport={passed:true,fixtureOnly:true,checks:['internal redirect returns 200 without browser redirect','HLS segments use final redirect directory','cross-origin credentials stripped','segment bytes pass through','Range and 206 preserved','redirected SRT converted to VTT','503 does not substitute content','redirect loop bounded','private redirect blocked']};
writeFileSync('verification/proxy-46.json',JSON.stringify(proxyReport,null,2));console.log(proxyReport);process.exit(0);
