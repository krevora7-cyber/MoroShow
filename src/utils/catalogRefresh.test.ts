import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../server/db';
test('progressive catalog refresh preserves a registered episode and its playable variant',()=>{
 const episode = { id:'episode-test',name:'Test S01E01',kind:'series' as const,category:'Drama',streamUrl:'https://example.test/episode.m3u8',streamType:'hls' as const,seriesTitle:'Test',season:1,episode:1,isKidFriendly:false };
 const [registered]=db.registerEpisodes([episode]);
 db.loadPlaylistItems([{...episode,id:'film-test',name:'Test film',kind:'movie',seriesTitle:undefined,season:undefined,episode:undefined}],true);
 assert.equal(db.getContentById(registered.id)?.episode,1);
 assert.ok(db.getStreamForDevice(registered.id,false));
});
