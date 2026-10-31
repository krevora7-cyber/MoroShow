import test from 'node:test';
import assert from 'node:assert/strict';
import { parseM3U } from './m3uParser';
import {groupCatalog} from './groupCatalog';

test('quality variants collapse under one channel, different channel numbers remain distinct',()=>{
const m3u=`#EXTM3U
#EXTINF:-1 group-title="Sports 4K",beIN Sports 1 4K
https://example.org/1/4k.ts
#EXTINF:-1 group-title="Sports HD",beIN Sports 1 HD
https://example.org/1/hd.ts
#EXTINF:-1 group-title="Sports SD",beIN Sports 1 SD
https://example.org/1/sd.ts
#EXTINF:-1 group-title="Sports HD",beIN Sports 11 HD
https://example.org/11/hd.ts`;
const {items,rawByVariant}=groupCatalog(parseM3U(m3u).items);
assert.equal(items.length,2);
const channel=items.find(x=>x.name==='beIN Sports 1');
assert.ok(channel);
assert.deepEqual(channel.variants.map(x=>x.quality),['4K','HD','SD']);
assert.equal(new Set(channel.variants.map(x=>x.id)).size,3);
assert.equal(channel.streamUrl,'');
assert.ok(rawByVariant.get(channel.variants[0].id)?.streamUrl.endsWith('.ts'));
});
test('separate movie remakes but combine source languages, quality, and episode versions',()=>{
const m3u=`#EXTM3U
#EXTINF:-1 group-title="Movies VOD",Titanic (1997) 4K VF
https://example.org/movie/fr.mp4
#EXTINF:-1 group-title="Movies VOD",Titanic (1997) HD VOSTFR
https://example.org/movie/vostfr.mp4
#EXTINF:-1 group-title="Movies VOD",Titanic (1953) SD
https://example.org/movie/old.mp4
#EXTINF:-1 group-title="Series",Example Show S01E01 FHD
https://example.org/series/1a.mp4
#EXTINF:-1 group-title="Series",Example Show S01E01 HD
https://example.org/series/1b.mp4
#EXTINF:-1 group-title="Series",Example Show S01E02 HD
https://example.org/series/2.mp4`;
const {items}=groupCatalog(parseM3U(m3u).items);
assert.equal(items.length,4);
const film=items.find(x=>x.name==='Titanic (1997)');
assert.ok(film);
assert.equal(film.variants.length,2);
assert.deepEqual(film.variants.map(v=>v.language),['FR','VOSTFR']);
assert.equal(items.filter(x=>x.kind==='series').length,2);
});
