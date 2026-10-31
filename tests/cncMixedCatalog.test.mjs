import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGateway, classifyMetadata, getGatewayRefs, loadGatewayEpisodes, registerGatewayItems, resolveGatewayStream} from '../src/server/addonGateway.ts';
import {fnv1a64} from '../src/utils/fnv1a64.ts';
import {consolidationKey} from '../src/utils/groupCatalog.ts';
const id=x=>'ns-g-'+fnv1a64(consolidationKey(x.item));
test('CNC mixed other shelf resolves title/type and keeps original routes through episode playback',async()=>{
 const seen=[];
 const fetcher=async url=>{
  const p=new URL(url).pathname;seen.push(p);
  let body;
  if(p.endsWith('/manifest.json'))body={catalogs:[{id:'mixed',type:'other'},{id:'events',type:'tv'}]};
  else if(p.includes('/catalog/other/'))body={metas:[{id:'movie',name:'⠀',type:'other'},{id:'show',name:'⠀',type:'other'},{id:'unknown',name:'Unknown',type:'other'}]};
  else if(p.includes('/meta/other/movie'))body={meta:{id:'movie',name:'A Film',type:'other',runtime:'100 min'}};
  else if(p.includes('/meta/other/show'))body={meta:{id:'show',name:'A Show',type:'other',videos:[{id:'episode',season:1,episode:1}]}};
  else if(p.includes('/meta/other/unknown'))body={meta:{id:'unknown',name:'Unclassified',type:'other'}};
  else if(p.includes('/catalog/tv/'))body={metas:[{id:'event',name:'Upcoming Match',type:'tv'}]};
  else if(p.includes('/stream/other/episode'))body={streams:[{url:'https://media.example.test/episode.m3u8'}]};
  else throw Error('Unexpected route '+p);
  return new Response(JSON.stringify(body));
 };
 const env={NETSHOW_ADDON_CNC_VERSE_URL:'https://bridge.example.test/u/profile/manifest.json',NETSHOW_ADDON_CRICIFY_URL:'https://bridge.example.test/u/profile/manifest.json'};
 const d=await loadGateway(fetcher,env);
 assert.equal(d.items.length,3);
 const show=d.items.find(x=>x.item.kind==='series');
 assert.equal(d.items.find(x=>x.item.kind==='movie').item.name,'A Film');
 assert.equal(d.items.find(x=>x.item.kind==='live').item.category,'Cricify Events');
 assert.equal(getGatewayRefs(id(show))[0].type,'other');
 const eps=await loadGatewayEpisodes(id(show),fetcher);registerGatewayItems(eps,false);
 assert.equal((await resolveGatewayStream(id(eps[0]),fetcher)).kind,'hls');
 assert.ok(seen.includes('/u/profile/stream/other/episode.json'));
});
test('unknown mixed metadata is not silently presented as a movie',()=>{
 assert.equal(classifyMetadata({type:'other',name:'Unknown'}),null);
 assert.equal(classifyMetadata({type:'other',videos:[{episode:1}]}),'series');
});

test('provider request headers reject transport overrides and stay out of signed client tokens', async()=>{
 const {providerHeaders}=await import('../src/server/addonGateway.ts');
 const {generatePlaybackToken,verifyPlaybackToken}=await import('../src/utils/security.ts');
 const headers=providerHeaders({'X-MB-Token':'provider-token',Cookie:'session=value',Host:'127.0.0.1',Connection:'keep-alive',Referer:'bad\r\nInjected: yes'});
 assert.deepEqual(headers,{'x-mb-token':'provider-token',cookie:'session=value'});
 const token=generatePlaybackToken({contentId:'film',profileId:'adult',streamUrl:'https://media.example.test/video.mp4',streamType:'mp4',isKidProfile:false,streamHeaders:headers});
 assert.ok(!Buffer.from(token.split('.')[0],'base64url').toString().includes('provider-token'));
 assert.deepEqual(verifyPlaybackToken(token).payload.streamHeaders,headers);
});

test('server selection keeps private headers and captions paired with the selected video',async()=>{
 const ref={source:'cnc-verse',base:'https://bridge.example.test',type:'movie',videoId:'captioned',name:'Captioned',kind:'movie'};
 const item={id:'captioned',name:'Captioned',kind:'movie',category:'Drama',streamUrl:'https://example.test/x',streamType:'mp4',isKidFriendly:false};
 registerGatewayItems([{item,ref}]);
 const fetcher=async()=>new Response(JSON.stringify({streams:[{externalUrl:'https://example.test/donate'},{url:'https://cdn.example.test/one.mp4',name:'English'},{url:'https://cdn.example.test/two.mp4',name:'French',behaviorHints:{proxyHeaders:{request:{Cookie:'private'}}},subtitles:[{url:'https://cdn.example.test/ar.srt',lang:'ar'}]}]}));
 const selected=await resolveGatewayStream(id({item}),fetcher,'gw:1');
 assert.equal(selected.url,'https://cdn.example.test/two.mp4');assert.equal(selected.variants.length,2);assert.equal(selected.subtitles[0].lang,'ar');assert.equal(selected.headers.cookie,'private');
 assert.ok(!JSON.stringify(selected.variants).includes('https:'));
 await assert.rejects(resolveGatewayStream(id({item}),fetcher,'gw:99'));
});

test('every provider gets an initial batch and the configured limit is respected',async()=>{
 const seen=[];
 const fetcher=async url=>{const p=new URL(url).pathname;let body;
 if(p.endsWith('manifest.json'))body={catalogs:[{id:'one',type:'movie'},{id:'two',type:'movie'}]};
 else {seen.push(p);body={metas:Array.from({length:12},(_,i)=>({id:p+'-'+i,name:p+' '+i,type:'movie'}))};}
 return new Response(JSON.stringify(body));};
 const loaded=await loadGateway(fetcher,{NETSHOW_ADDON_CNC_VERSE_URL:'https://fair.example.test/manifest.json',NETSHOW_CATALOG_PER_SOURCE:'2'});
 assert.equal(loaded.items.length,4);assert.equal(seen.length,2);
});
