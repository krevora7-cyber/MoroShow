import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGateway, resolveGatewayStream, loadGatewayEpisodes, getGatewayRefs, gatewayStatus, allowedAddonOrigin } from '../src/server/addonGateway.ts';
import { fnv1a64 } from '../src/utils/fnv1a64.ts';
import { consolidationKey } from '../src/utils/groupCatalog.ts';
const hosts={
 'NETSHOW_ADDON_CNC_VERSE_URL':'https://cnc.example.test/manifest.json',
 'NETSHOW_ADDON_STREAMPLAY_URL':'https://streamplay.example.test/manifest.json',
 'NETSHOW_ADDON_YACINTV_URL':'https://live.example.test/manifest.json',
 'NETSHOW_ADDON_CRICIFY_URL':'https://events.example.test/manifest.json',
};
const kindByHost={'cnc.example.test':'movie','streamplay.example.test':'series','live.example.test':'tv','events.example.test':'tv'};
function fixture(url){
 const u=new URL(url),type=kindByHost[u.hostname],id=u.hostname.split('.')[0];
 if(u.pathname==='/manifest.json')return {catalogs:[{type,id}]};
 if(u.pathname.startsWith('/catalog/'))return {metas:[{id:id+'-1',name:id==='cnc'?'Sample Film':id==='streamplay'?'Sample Show':id==='live'?'Sample Channel':'Sample Event',poster:'https://images.example.test/sample.jpg',description:'Public integration test metadata'}]};
 if(u.pathname.startsWith('/meta/'))return {meta:{videos:[{id:'ep:1',season:1,episode:1,thumbnail:'https://images.example.test/ep.jpg'}]}};
 if(u.pathname.startsWith('/stream/'))return {streams:[{url:'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'}]};
 throw Error('Unexpected request '+url);
}
const fetcher=async url=>new Response(JSON.stringify(fixture(url)),{status:200,headers:{'content-type':'application/json'}});
let loaded;
test('all four configured addon APIs provide real catalog structures', async()=>{
 loaded=await loadGateway(fetcher,hosts);
 assert.equal(loaded.items.length,4);
 assert.equal(loaded.status.filter(x=>x.status==='connected').length,4);
 assert.deepEqual(loaded.items.map(x=>x.item.kind),['movie','series','live','live']);
 assert.ok(loaded.items.every(x=>x.item.logoUrl?.startsWith('https://')));
});
test('lazy movie stream resolves HTTP HLS from selected addon',async()=>{
 const sample=loaded.items[0].item;
 const id=`ns-g-${fnv1a64(consolidationKey(sample))}`;
 assert.ok(getGatewayRefs(id).length);
 const stream=await resolveGatewayStream(id,fetcher);
 assert.equal(stream.kind,'hls');assert.equal(stream.source,'cnc-verse');
});
test('series episode list resolves one real episode ID',async()=>{
 const sample=loaded.items[1].item;
 const id=`ns-g-${fnv1a64(consolidationKey(sample))}`;
 const episodes=await loadGatewayEpisodes(id,fetcher);
 assert.equal(episodes.length,1);assert.equal(episodes[0].item.episode,1);
});
test('gateway refuses arbitrary private media origins',()=>{
 assert.equal(allowedAddonOrigin('http://127.0.0.1/admin',hosts),false);
 assert.equal(allowedAddonOrigin('https://cnc.example.test/video',hosts),true);
});
test('unconfigured four-extension gateway is transparently empty',async()=>{
 const data=await loadGateway(fetcher,{});
 assert.equal(data.items.length,0);assert.equal(gatewayStatus().filter(s=>s.status==='not_configured').length,5);
});
