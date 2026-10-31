import test from 'node:test';
import assert from 'node:assert/strict';
import {shortCatalog,shortDetails,shortStream,parseShortId} from '../src/server/shortProviders';
import {rewriteDramaManifest,safeDramaMediaUrl} from '../src/server/dramaPlayback';

test('provider requests normalize catalog, chapters and playable streams without mixing providers',async()=>{
 const original=globalThis.fetch;process.env.GOODSHORT_AUTH_TOKEN='test-only';process.env.REELSHORT_AUTH_TOKEN='test-only';
 globalThis.fetch=async(input:any,init:any)=>{
  assert.equal(init.headers.Authorization,'Bearer test-only');const u=new URL(String(input));let data:any;
  if(u.pathname.includes('/goodshort/')){
   if(u.pathname.endsWith('/home'))data={data:{records:[{items:[{bookId:'g1',bookName:'Good title',cover:'https://example.org/g.jpg'}]}]}};
   else if(u.pathname.includes('/book/'))data={data:{book:{bookId:'g1',bookName:'Good title'}}};
   else if(u.pathname.includes('/chapters/'))data={data:{list:[{id:11,name:'First'}]}};
   else if(u.pathname.includes('/play/'))data={m3u8:'https://video.goodshort.com/first.m3u8'};
  }else{
   if(u.pathname.endsWith('/foryou'))data={data:{lists:[{books:[{book_id:'r1',book_title:'Reel title'}]}]}};
   else if(u.pathname.endsWith('/chapters'))data={data:{chapters:[{chapter_id:'c1',chapter_name:'First',is_lock:0}]}};
   else if(u.pathname.endsWith('/video'))data={data:{videos:[{Encode:'H264',PlayURL:'https://video.crazymaplestudios.com/first.m3u8'}]}};
   else data={data:{book_id:'r1',book_title:'Reel title'}};
  }
  assert.ok(data,'unexpected endpoint '+u.pathname);return Response.json(data);
 };
 try{for(const p of ['goodshort','reelshort']){const d=await shortCatalog(p,1,'');assert.equal(d.items.length,1);assert.ok(d.items[0].id.startsWith('short:'+p+':'));const details=await shortDetails(d.items[0].id);assert.equal(details.episodes.length,1);const stream=await shortStream(details.episodes[0].id);assert.equal(stream.provider,p);assert.equal(stream.kind,'hls');assert.ok(stream.url.startsWith('https://'));}}
 finally{globalThis.fetch=original;delete process.env.GOODSHORT_AUTH_TOKEN;delete process.env.REELSHORT_AUTH_TOKEN;}
});
test('missing credentials and removed sources fail explicitly',async()=>{
 await assert.rejects(shortCatalog('goodshort',1,''),/GOODSHORT_AUTH_TOKEN/);
 await assert.rejects(shortCatalog('reelshort',1,''),/REELSHORT_AUTH_TOKEN/);
 await assert.rejects(shortCatalog('dramatip',1,''),/Unknown Shorts/);
 assert.throws(()=>parseShortId('short:goodshort:../secret'),/Invalid/);
});
test('local HLS keys stay behind opaque leases and media destinations remain restricted',()=>{
 const manifest=rewriteDramaManifest('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="local://key"\nfirst.ts','https://video.goodshort.com/a/master.m3u8',Buffer.alloc(16,1));
 assert.match(manifest,/URI="\/api\/shorts\/key\/[a-f0-9]{48}"/);assert.match(manifest,/\/api\/clips\/media\//);
 assert.throws(()=>safeDramaMediaUrl('https://127.0.0.1/private'),/Unsupported/);
 assert.throws(()=>rewriteDramaManifest('#EXT-X-KEY:URI="local://key"','https://video.goodshort.com/a.m3u8'),/Missing/);
});
