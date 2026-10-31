import test from 'node:test';import assert from 'node:assert/strict';import {createCipheriv,randomBytes} from 'node:crypto';
import express from 'express';
import {decodeDramaSource,safeDramaMediaUrl,mediaLease,registerDramaMedia} from '../src/server/dramaPlayback';
import {discoverDramaEpisodeSubtitles} from '../src/server/dramaSource';
import {orderEmbedVariants} from '../src/player/embedPresentation';
const encode=(url:string)=>{const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',Buffer.from('QC6Ir2trghxRAyyyWZEOEFR4GgLhnfQ4A19I3QBlQkc=','base64'),iv);return Buffer.concat([iv,c.update(url),c.final(),c.getAuthTag()]).toString('base64');};
const flight=(v:any)=>'<script>self.__next_f.push('+JSON.stringify([1,'1:'+JSON.stringify(v)+'\n'])+')</script>';
test('reported nsstorage video host is permitted exactly, with relay playlists and range bytes',async()=>{
 const real=globalThis.fetch,source='https://cdn2.nsstorage.space/video/episode1.m3u8';assert.equal(decodeDramaSource(encode(source)),source);
 for(const bad of ['https://cdn3.nsstorage.space/x','https://cdn2.nsstorage.space.evil.test/x','http://cdn2.nsstorage.space/x','https://cdn2.nsstorage.space:8080/x','https://127.0.0.1/x'])assert.throws(()=>safeDramaMediaUrl(bad));
 globalThis.fetch=(async(input:any,init:any)=>{const u=new URL(String(input));if(u.hostname!=='cdn2.nsstorage.space')return real(input,init);if(u.pathname.endsWith('.m3u8'))return new Response('#EXTM3U\n#EXT-X-TARGETDURATION:5\n#EXTINF:5,\npart1.ts\n#EXT-X-ENDLIST\n',{headers:{'content-type':'application/vnd.apple.mpegurl'}});assert.equal(init.headers.Range,'bytes=0-1023');return new Response(new Uint8Array([0x47,1,2,3]),{status:206,headers:{'content-type':'video/mp2t','content-range':'bytes 0-3/4'}});}) as typeof fetch;
 const app=express();registerDramaMedia(app);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as any).port}`;
 try{const path=mediaLease(source),manifest=await real(base+path).then(r=>r.text());assert.ok(!manifest.includes('nsstorage'));const segment=manifest.split('\n').find(l=>l.startsWith('/api/clips/media/'))!;const r=await real(base+segment,{headers:{Range:'bytes=0-1023'}});assert.equal(r.status,206);assert.equal(new Uint8Array(await r.arrayBuffer())[0],0x47);}finally{globalThis.fetch=real;server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
test('missing subtitle files and failed subtitle discovery remain distinct and retryable',async()=>{
 const real=globalThis.fetch,slug='discovery-retry-499',book='abcdef1234567890abcdef99';let fail=true,count=0;
 globalThis.fetch=(async(input:any)=>{const u=new URL(String(input));if(u.hostname!=='dramatip.net')return real(input);if(u.pathname.startsWith('/api/')){count++;if(fail)throw new Error('Network unavailable');return new Response(JSON.stringify({descriptor:null}));}return new Response(flight({slug,id:book,currentSerial:1,sourceFirst:{chain:[],subtitle:null}}));}) as typeof fetch;
 try{const first=await discoverDramaEpisodeSubtitles('drama:'+slug+':1');assert.equal(first.complete,false);assert.deepEqual(first.tracks,[]);const n=count;fail=false;const second=await discoverDramaEpisodeSubtitles('drama:'+slug+':1');assert.ok(count>n);assert.equal(second.complete,true);assert.deepEqual(second.tracks,[]);}finally{globalThis.fetch=real;}
});
test('Cinezo is first on iPhone and desktop, without mutating supplied variants',()=>{
 const input=[{id:'vidlink'},{id:'vidsrc-mov'},{id:'cinezo'},{id:'vidsrc-sh'}];for(const ios of [true,false])assert.deepEqual(orderEmbedVariants(input,ios).map(v=>v.id),['cinezo','vidsrc-mov','vidlink','vidsrc-sh']);assert.equal(input[0].id,'vidlink');
});

test('reported GoodReels CDN host is exact and all servers remain in app',()=>{
 assert.equal(safeDramaMediaUrl('https://v2-akm.goodreels.com/a.m3u8').hostname,'v2-akm.goodreels.com');
 for(const value of ['https://v2-akm.goodreels.com.evil.test/x','https://other.goodreels.com/x','http://v2-akm.goodreels.com/x','https://v2-akm.goodreels.com:444/x'])assert.throws(()=>safeDramaMediaUrl(value));
});
