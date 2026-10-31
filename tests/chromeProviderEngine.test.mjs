import test from 'node:test';
import assert from 'node:assert/strict';
import {browserItem,loadBrowserProviders,hasBrowserRef,browserEpisodes,browserPlayback,getBrowserStatus} from '../src/server/chromeProviderEngine.ts';
const movies={id:'streamplay',async list(){return [{externalId:'movie-7',kind:'movie',section:'movies',name:'Permitted Film',poster:'https://images.example.org/m.jpg'}, {externalId:'show-1',kind:'series',section:'series',name:'Open Show'}]},async streams(id){return [{url:`https://example.org/${id}.m3u8`}]},async episodes(id){return [{externalId:'ep-1',kind:'series',section:'series',name:'Open Show S01E01',season:1,episode:1,seriesName:'Open Show'}]}};
const tv={id:'yacintv',async list(){return [{externalId:'live-1',kind:'live',section:'live',name:'Public Channel'}]},async streams(id){return [{url:`https://example.org/${id}.m3u8`}]}};
const failing={id:'cricify',async list(){throw Error('Feed unavailable')},async streams(){return []}};
test('entry validation enforces requested section and rejects non-web image',()=>{
 assert.equal(browserItem({externalId:'x',kind:'movie',section:'live',name:'invalid'},'streamplay'),null);
 assert.equal(browserItem({externalId:'ok',kind:'movie',section:'movies',name:'Film',poster:'file:///secret'},'streamplay')?.item.logoUrl,undefined);
});
test('loads catalog from independent JS providers and isolates failure',async()=>{
 const r=await loadBrowserProviders([movies,tv,failing]);
 assert.equal(r.items.length,3);assert.equal(r.status.find(x=>x.source==='cricify').state,'failed');
 assert.equal(r.status.find(x=>x.source==='cnc-verse').state,'not_ported');
});
test('movie stream resolver returns real adapter-supplied URL',async()=>{
 const {items}=await loadBrowserProviders([movies]);
 const media=items.find(x=>x.item.kind==='movie');
 const {consolidationKey}=await import('../src/utils/groupCatalog.ts');
 const {fnv1a64}=await import('../src/utils/fnv1a64.ts');
 const id=`ns-g-${fnv1a64(consolidationKey(media.item))}`;
 assert.equal(hasBrowserRef(id),true);
 const playback=await browserPlayback(id);
 assert.equal(playback.kind,'hls');assert.match(playback.url,/movie-7\.m3u8$/);
});
test('loads on-demand episode and resolves episode stream',async()=>{
 const {items}=await loadBrowserProviders([movies]);
 const {consolidationKey}=await import('../src/utils/groupCatalog.ts');
 const {fnv1a64}=await import('../src/utils/fnv1a64.ts');
 const original=items.find(x=>x.item.name==='Open Show');
 const id=`ns-g-${fnv1a64(consolidationKey(original.item))}`;
 const list=await browserEpisodes(id);assert.equal(list.length,1);assert.equal(list[0].item.episode,1);
 const epId=`ns-g-${fnv1a64(consolidationKey(list[0].item))}`;
 assert.match((await browserPlayback(epId)).url,/ep-1\.m3u8$/);
});
test('refuses missing provider playback instead of faking success',async()=>{
 await loadBrowserProviders([]);
 assert.equal(getBrowserStatus().every(x=>x.state==='not_ported'),true);
 await assert.rejects(browserPlayback('missing'),/No native browser provider/);
});
