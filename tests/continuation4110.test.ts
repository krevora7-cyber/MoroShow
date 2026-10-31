import test from 'node:test';import assert from 'node:assert/strict';import {createCipheriv} from 'node:crypto';import fs from 'node:fs';
import {safeDramaMediaUrl,providerMediaUrl,rewriteDramaManifest,unwrapDramaMedia} from '../src/server/dramaPlayback';
import {decodeShortsSegment} from '../src/server/shortsSegment';
import {readEmbedProgress} from '../src/player/embedEvents';
import {AVATAR_OPTIONS} from '../src/types';
test('provider wrappers validate the embedded destination and preserve relative HLS paths',()=>{
 const source='https://volcengine-forward.storyreel.life/hls/one/main.m3u8',wrapped=providerMediaUrl(source,'storyreel');assert.equal(unwrapDramaMedia(wrapped),source);assert.match(rewriteDramaManifest('#EXTM3U\nsegment.ts\n',wrapped),/api\/clips\/media\/[a-f0-9]{48}/);
 for(const host of ['127.0.0.1','localhost','169.254.169.254','evil.test','cdnvideo.cdreader.com.evil.test'])assert.throws(()=>safeDramaMediaUrl('https://hls-proxy-i4ic7.b-cdn.net/?url='+encodeURIComponent('https://'+host+'/x')));
 for(const host of ['cdnvideo.cdreader.com','media.tqshort.com'])assert.equal(safeDramaMediaUrl('https://'+host+'/x').hostname,host);
});
test('public segment envelope produces original TS and rejects malformed headers',()=>{
 const header=Buffer.alloc(1024,32),key=Buffer.from('1234567890abcdef'),payload=Buffer.alloc(188*3,0x47);header.write('0032',16);key.copy(header,32);const c=createCipheriv('aes-128-cbc',key,Buffer.from('shortmax00000000')),encrypted=Buffer.concat([c.update(payload),c.final()]);header.write(String(encrypted.length).padStart(4,'0'),20);const data=Buffer.concat([header,encrypted]);assert.deepEqual(decodeShortsSegment(data,'https://volcengine-forward.shorttv.live/hls-encrypted-full/a.ts'),payload);assert.throws(()=>decodeShortsSegment(Buffer.alloc(1050),'https://volcengine-forward.shorttv.live/hls-encrypted/a.ts'));assert.equal(decodeShortsSegment(payload,'https://media.tqshort.com/a.ts'),payload);
});
test('Cinezo progress validates source, title, episode and numerical ranges',()=>{
 const origin='https://player.cinezo.live',message={type:'PLAYER_EVENT',data:{tmdbId:42,mediaType:'tv',season:2,episode:3,currentTime:100,duration:1000,event:'pause'}};
 assert.equal(readEmbedProgress(origin,message,origin,'w32:tv:42:2:3')?.time,100);
 for(const id of ['w32:tv:42:2:4','w32:movie:42','w32:tv:43:2:3'])assert.equal(readEmbedProgress(origin,message,origin,id),null);
 assert.equal(readEmbedProgress('https://evil.test',message,origin,'w32:tv:42:2:3'),null);assert.equal(readEmbedProgress(origin,{...message,data:{...message.data,currentTime:Infinity}},origin,'w32:tv:42:2:3'),null);
});
test('exactly 28 supplied avatar files are available and distinct',()=>{assert.equal(AVATAR_OPTIONS.length,28);assert.equal(new Set(AVATAR_OPTIONS.map(a=>a.id)).size,28);for(const a of AVATAR_OPTIONS)assert.ok(fs.statSync('public'+a.image).size>0);});
import {readDramaPlayer} from '../src/server/dramaSource';
test('zero-based source serials map to displayed episodes without accepting the next episode',()=>{
 const html=(v:any)=>'<script>self.__next_f.push('+JSON.stringify([1,'1:'+JSON.stringify(v)+'\n'])+')</script>';
 const zero={slug:'zero-series',currentSerial:0,firstSerial:0,sourceFirst:{chain:[]},nextSourceFirst:{chain:[{enc:'not-current'}]}};
 assert.equal(readDramaPlayer(html(zero),'zero-series',1)?.currentSerial,0);assert.equal(readDramaPlayer(html({...zero,currentSerial:1}),'zero-series',2)?.currentSerial,1);
 assert.equal(readDramaPlayer(html({...zero,currentSerial:1}),'zero-series',1),undefined);assert.equal(readDramaPlayer(html(zero),'other-series',1),undefined);
 assert.equal(readDramaPlayer(html({...zero,firstSerial:1,currentSerial:1}),'zero-series',1)?.currentSerial,1);
 assert.equal(readDramaPlayer(html({...zero,firstSerial:5,currentSerial:5}),'zero-series',1),undefined);
 assert.equal(readDramaPlayer(html({...zero,firstSerial:5,currentSerial:5}),'zero-series',5)?.currentSerial,5);
 assert.equal(readDramaPlayer(html({...zero,firstSerial:5,currentSerial:6}),'zero-series',1),undefined);
});
test('length-prefixed Next data and token references resolve after UTF-8 text records',()=>{
 const token='encoded-token-value',text='العربية 👋\n raw text';const props={slug:'flight-story',currentSerial:1,firstSerial:1,sourceFirst:{chain:[{type:'mp4',enc:'$a'}]}};
 const data='9:T'+Buffer.byteLength(text).toString(16)+','+text+'a:T'+Buffer.byteLength(token).toString(16)+','+token+'b:'+JSON.stringify(props)+'\n';
 const html='<script>self.__next_f.push('+JSON.stringify([1,data.slice(0,30)])+')</script><script>self.__next_f.push('+JSON.stringify([1,data.slice(30)])+')</script>';
 assert.equal(readDramaPlayer(html,'flight-story',1)?.sourceFirst.chain[0].enc,token);assert.equal(readDramaPlayer(html,'flight-story',2),undefined);
});
import {dramaUpstream} from '../src/server/dramaPlayback';
test('IDrama public player key route accepts only its bounded key parameters',async()=>{
 const url='https://api.idrama.video/shorts/open/drm/kds/api/v1/keys?source=test&ak='+'a'.repeat(32);assert.equal(safeDramaMediaUrl(url).hostname,'api.idrama.video');
 for(const bad of [url+'&url=https://localhost',url.replace('/keys?','/other?'),url.replace('api.idrama.video','api.idrama.video.evil.test'),url.replace('source=test','source=..')])assert.throws(()=>safeDramaMediaUrl(bad));
 const original=globalThis.fetch;globalThis.fetch=(async(input:any,init:any)=>{const u=new URL(String(input));assert.equal(u.origin,'https://dramatip.net');assert.equal(u.pathname,'/api/idrama-key');assert.equal(u.searchParams.get('ak'),'a'.repeat(32));assert.equal(init.headers.Referer,'https://dramatip.net/');return new Response(new Uint8Array(16));}) as typeof fetch;
 try{const {r}=await dramaUpstream(url);assert.equal((await r.arrayBuffer()).byteLength,16);}finally{globalThis.fetch=original;}
});
import {resolveDramaEpisodeSource} from '../src/server/dramaSource';
test('a readable playlist with an expired first segment refreshes the same episode',async()=>{
 const encode=(value:string)=>{const iv=Buffer.alloc(12,7),cipher=createCipheriv('aes-256-gcm',Buffer.from('QC6Ir2trghxRAyyyWZEOEFR4GgLhnfQ4A19I3QBlQkc=','base64'),iv);return Buffer.concat([iv,cipher.update(value),cipher.final(),cipher.getAuthTag()]).toString('base64');};
 const old='https://cdn2.nsstorage.space/old.m3u8',fresh='https://cdn2.nsstorage.space/fresh.m3u8',book='abcdef1234567890abcdef12',slug='segment-refresh-4110',seen:string[]=[],original=globalThis.fetch;
 const descriptor=(url:string)=>({chain:[{type:'hls',enc:encode(url)}]});const props={slug,bookId:book,currentSerial:2,sourceFirst:descriptor(old),nextSourceFirst:descriptor('https://cdn2.nsstorage.space/wrong-next.m3u8')};
 globalThis.fetch=(async(input:any)=>{const u=new URL(String(input));seen.push(u.pathname);if(u.hostname==='dramatip.net'){if(u.pathname.startsWith('/api/')){assert.ok(u.pathname.endsWith('/2'));return new Response(JSON.stringify({descriptor:descriptor(fresh)}));}return new Response('<script>self.__next_f.push('+JSON.stringify([1,'1:'+JSON.stringify(props)+'\n'])+')</script>');}if(u.pathname.endsWith('.m3u8'))return new Response('#EXTM3U\n#EXTINF:5,\n'+(u.pathname.includes('old')?'old.ts':'fresh.ts')+'\n#EXT-X-ENDLIST\n');if(u.pathname==='/old.ts')return new Response('',{status:403});return new Response(new Uint8Array([0x47,1,2]),{status:206});}) as typeof fetch;
 try{const result=await resolveDramaEpisodeSource('drama:'+slug+':2');assert.equal(result.url,fresh);assert.ok(seen.includes('/old.ts'));assert.ok(seen.includes('/fresh.ts'));assert.ok(!seen.some(p=>p.includes('wrong-next')));}finally{globalThis.fetch=original;}
});
import express from 'express';
import {mediaLease,registerDramaMedia} from '../src/server/dramaPlayback';
test('BOM playlists and mislabeled transport-stream chunks preserve their real media type',async()=>{
 const original=globalThis.fetch,ts=Buffer.alloc(188*3);ts[0]=ts[188]=ts[376]=0x47;
 globalThis.fetch=(async(input:any,init:any)=>{const u=new URL(String(input));if(u.hostname!=='cdn2.nsstorage.space')return original(input,init);if(u.pathname.endsWith('.m3u8'))return new Response('\uFEFF#EXTM3U\n#EXTINF:5,\npart.ts\n#EXT-X-ENDLIST\n',{headers:{'content-type':'application/octet-stream'}});return new Response(ts,{headers:{'content-type':'application/vnd.apple.mpegurl'}});}) as typeof fetch;
 const app=express();registerDramaMedia(app);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as any).port}`;
 try{const r=await original(base+mediaLease('https://cdn2.nsstorage.space/bom.m3u8'));assert.match(r.headers.get('content-type')||'',/mpegurl/);const text=await r.text();assert.ok(text.startsWith('#EXTM3U'));const path=text.split('\n').find(l=>l.startsWith('/api/clips/media/'))!;const segment=await original(base+path);assert.match(segment.headers.get('content-type')||'',/video\/mp2t/);assert.deepEqual(Buffer.from(await segment.arrayBuffer()),ts);}finally{globalThis.fetch=original;server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
test('a segment that loops back to its own playlist refreshes instead of opening a black player',async()=>{
 const encode=(value:string)=>{const iv=Buffer.alloc(12,8),cipher=createCipheriv('aes-256-gcm',Buffer.from('QC6Ir2trghxRAyyyWZEOEFR4GgLhnfQ4A19I3QBlQkc=','base64'),iv);return Buffer.concat([iv,cipher.update(value),cipher.final(),cipher.getAuthTag()]).toString('base64');};
 const old='https://cdn2.nsstorage.space/loop.m3u8',fresh='https://cdn2.nsstorage.space/clean.m3u8',slug='loop-refresh-4110',book='abcdef1234567890abcdef13',seen:string[]=[],original=globalThis.fetch;
 const descriptor=(url:string)=>({chain:[{type:'hls',enc:encode(url)}]});
 globalThis.fetch=(async(input:any)=>{const u=new URL(String(input));seen.push(u.pathname);if(u.hostname==='dramatip.net'){if(u.pathname.startsWith('/api/')){assert.ok(u.pathname.endsWith('/2'));return new Response(JSON.stringify({descriptor:descriptor(fresh)}));}return new Response('<script>self.__next_f.push('+JSON.stringify([1,'1:'+JSON.stringify({slug,bookId:book,currentSerial:2,sourceFirst:descriptor(old)})+'\n'])+')</script>');}if(u.pathname.includes('loop'))return new Response('#EXTM3U\n#EXTINF:5,\nloop.ts\n#EXT-X-ENDLIST\n');if(u.pathname.endsWith('.m3u8'))return new Response('#EXTM3U\n#EXTINF:5,\nclean.ts\n#EXT-X-ENDLIST\n');return new Response(new Uint8Array([0x47,1,2]));}) as typeof fetch;
 try{const result=await resolveDramaEpisodeSource('drama:'+slug+':2');assert.equal(result.url,fresh);assert.ok(seen.filter(p=>p==='/loop.ts').length<=2);}finally{globalThis.fetch=original;}
});
test('source refresh takes the book ID from the verified current player without a second title lookup',async()=>{
 const encode=(value:string)=>{const iv=Buffer.alloc(12,9),cipher=createCipheriv('aes-256-gcm',Buffer.from('QC6Ir2trghxRAyyyWZEOEFR4GgLhnfQ4A19I3QBlQkc=','base64'),iv);return Buffer.concat([iv,cipher.update(value),cipher.final(),cipher.getAuthTag()]).toString('base64');};
 const slug='current-book-4110',book='معرف-المسلسل-4110',old='https://cdn2.nsstorage.space/expired.mp4',fresh='https://cdn2.nsstorage.space/current.mp4',original=globalThis.fetch;
 const descriptor=(url:string)=>({chain:[{type:'mp4',enc:encode(url)}]});
 globalThis.fetch=(async(input:any)=>{const u=new URL(String(input));if(u.hostname==='dramatip.net'){if(u.pathname.startsWith('/api/')){assert.equal(decodeURIComponent(u.pathname),'/api/episode-source/'+book+'/3');return new Response(JSON.stringify({descriptor:descriptor(fresh)}));}assert.ok(u.pathname.endsWith('/episode-3'),'no second series-page lookup');return new Response('<script>self.__next_f.push('+JSON.stringify([1,'1:'+JSON.stringify({slug,bookId:book,currentSerial:3,sourceFirst:descriptor(old)})+'\n'])+')</script>');}return u.pathname.includes('expired')?new Response('',{status:403}):new Response(new Uint8Array([0,0,0,24,102,116,121,112]),{status:206});}) as typeof fetch;
 try{assert.equal((await resolveDramaEpisodeSource('drama:'+slug+':3')).url,fresh);}finally{globalThis.fetch=original;}
});
test('a failed media gateway can fall back to the same validated original CDN URL',async()=>{
 const original=globalThis.fetch,target='https://media.tqshort.com/fixture.m3u8';const calls:string[]=[];
 globalThis.fetch=(async(input:any)=>{const u=new URL(String(input));calls.push(u.hostname);return u.hostname==='media.tqshort.com'?new Response('#EXTM3U\n#EXT-X-ENDLIST\n'):new Response('',{status:502});}) as typeof fetch;
 try{const {r,url}=await dramaUpstream(providerMediaUrl(target,'hls'));assert.equal(r.status,200);assert.equal(url,target);assert.deepEqual(calls,['cdn.dramadizilerim.xyz','hls-proxy-i4ic7.b-cdn.net','media.tqshort.com']);}finally{globalThis.fetch=original;}
});

test('media resolution deadline aborts a stalled gateway without starting more requests',async()=>{
 const original=globalThis.fetch;let calls=0;const keepAlive=setInterval(()=>{},1000);
 globalThis.fetch=((_input:any,init:any)=>{calls++;return new Promise((_resolve,reject)=>{init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true});});}) as typeof fetch;
 try{await assert.rejects(dramaUpstream(providerMediaUrl('https://media.tqshort.com/deadline.m3u8','hls'),undefined,Date.now()+30));assert.equal(calls,1);}finally{clearInterval(keepAlive);globalThis.fetch=original;}
});
