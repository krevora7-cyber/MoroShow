import test from 'node:test';
import assert from 'node:assert/strict';
import {createCipheriv,randomBytes} from 'node:crypto';
import express from 'express';
import {decodeDramaSource,safeDramaMediaUrl,sourceFromDescriptor,mediaLease,rewriteDramaManifest,registerDramaMedia} from '../src/server/dramaPlayback.ts';
import {parseDramaBookId,resolveDramaEpisode,parseDramaDetails} from '../src/server/dramaSource.legacy.ts';
const key=Buffer.from('QC6Ir2trghxRAyyyWZEOEFR4GgLhnfQ4A19I3QBlQkc=','base64');
function encode(url:string){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv),data=Buffer.concat([c.update(url),c.final()]);return Buffer.concat([iv,data,c.getAuthTag()]).toString('base64');}
test('AES-GCM sources authenticate, reject tampering and block unsafe destinations',()=>{
 const url='https://v-mps.crazymaplestudios.com/test/master.m3u8';const enc=encode(url);assert.equal(decodeDramaSource(enc),url);
 const bytes=Buffer.from(enc,'base64');bytes[20]^=1;assert.throws(()=>decodeDramaSource(bytes.toString('base64')));
 for(const u of ['http://v.shortswave.com/a','https://127.0.0.1/a','https://v.shortswave.com.evil.test/a','https://v.shortswave.com:444/a','https://user:pass@v.shortswave.com/a'])assert.throws(()=>safeDramaMediaUrl(u));
 assert.throws(()=>decodeDramaSource(encode('https://evil.test/a')));
});
test('book IDs may be alphanumeric and serialized with escaped quotes; plain episode anchors work',()=>{
 for(const html of ['{"bookId":"6a81520ac5b72c406e058679"}','{\\"bookId\\":\\"6a81520ac5b72c406e058679\\"}'])assert.equal(parseDramaBookId(html),'6a81520ac5b72c406e058679');
 assert.equal(parseDramaDetails('<h1>Story</h1><a href="/series/story/episode-2">2</a>','story').episodes[0].episode,2);
});
test('manifest playlists, segments and encryption-key URIs use bounded media leases',()=>{
 const result=rewriteDramaManifest('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXTINF:4,\nv1.ts\n','https://v.shortswave.com/video/master.m3u8');
 assert.match(result,/URI="\/api\/clips\/media\/[a-f0-9]{48}"/);assert.match(result,/\n\/api\/clips\/media\/[a-f0-9]{48}\n/);assert.ok(!result.includes('v1.ts'));assert.throws(()=>rewriteDramaManifest('#EXTM3U\nhttps://evil.test/a.ts','https://v.shortswave.com/a'));
});
test('episode resolution and media proxy deliver manifests and bytes, reject unknown leases',async()=>{
 const real=globalThis.fetch;let apiSeen=false;
 const media='https://v.shortswave.com/test/master.m3u8';
 globalThis.fetch=(async(input:any,init:any)=>{
 const u=new URL(String(input));if(u.hostname==='dramatip.net'){
 if(u.pathname.startsWith('/series/'))return new Response('{"bookId":"abc123"}');
 assert.equal(u.pathname,'/api/episode-source/abc123/39');assert.equal(u.searchParams.get('lang'),'ar');apiSeen=true;
 return Response.json({descriptor:{chain:[{type:'hls',enc:encode(media)}]}});
 }
 if(u.hostname==='v.shortswave.com')return u.pathname.endsWith('.m3u8')?new Response('#EXTM3U\n#EXTINF:4,\nv1.ts\n',{headers:{'Content-Type':'application/vnd.apple.mpegurl'}}):new Response(new Uint8Array([0x47,1,2]),{headers:{'Content-Type':'video/mp2t'}});
 return real(input,init);
 }) as typeof fetch;
 const app=express();registerDramaMedia(app);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as any).port}`;
 try{
 assert.equal(await resolveDramaEpisode('drama:story:39'),media);assert.ok(apiSeen);
 const r=await real(base+mediaLease(media));assert.equal(r.status,200);const text=await r.text();const path=text.split('\n').find(x=>x.startsWith('/api/'))!;assert.ok(path);
 const segment=await real(base+path);assert.deepEqual([...new Uint8Array(await segment.arrayBuffer())],[0x47,1,2]);
 assert.equal((await real(base+'/api/clips/media/bad')).status,410);
 await assert.rejects(()=>sourceFromDescriptor({descriptor:{chain:[]}}));
 }finally{globalThis.fetch=real;server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
test('internal DramaTip IDs take priority over provider IDs like 49179',()=>{
 const current='6a81520ac5b72c406e058679';
 assert.equal(parseDramaBookId(`{"bookId":"49179"}\n{"bookId":"${current}"}`),current);
 const flight='1:'+JSON.stringify({book:{slug:'lent-out-by-my-boyfriend-claimed-by-his-rival',_id:current,bookId:'49179'},recommendations:[{slug:'other',_id:'aaaaaaaaaaaaaaaaaaaaaaaa',bookId:'777'}]})+'\n';
 const html=`<script>self.__next_f.push(${JSON.stringify([1,flight])})</script>`;
 assert.equal(parseDramaBookId(html,'lent-out-by-my-boyfriend-claimed-by-his-rival'),current);
 assert.throws(()=>parseDramaBookId('{"bookId":"aaaaaaaaaaaaaaaaaaaaaaaa"}{"bookId":"bbbbbbbbbbbbbbbbbbbbbbbb"}'),/CLIPS_ID_AMBIGUOUS/);
});
test('reported HTTP-200 descriptor:null retries only the original page language and preserves the episode',async()=>{
 const real=globalThis.fetch,old=process.env.DRAMATIP_LANGUAGE;process.env.DRAMATIP_LANGUAGE='ar';const calls:string[]=[];
 const current='6a81520ac5b72c406e058679',media='https://v.shortswave.com/same-episode.m3u8';
 globalThis.fetch=(async(input:any)=>{
  const u=new URL(String(input));calls.push(u.href);
  if(u.pathname.startsWith('/series/'))return new Response(`<html lang="en"><script>{"bookId":"49179"}</script><script>{"bookId":"${current}"}</script></html>`);
  assert.equal(u.pathname,`/api/episode-source/${current}/1`);
  return u.searchParams.get('lang')==='ar'?Response.json({descriptor:null}):Response.json({descriptor:{chain:[{type:'hls',enc:encode(media)}]}});
 }) as typeof fetch;
 try{
  const {resolveDramaEpisodeSource}=await import('../src/server/dramaSource.legacy.ts');
  const result=await resolveDramaEpisodeSource('drama:reported-null:1');
  assert.equal(result.url,media);assert.equal(result.language,'en');assert.equal(result.requestedLanguage,'ar');assert.match(result.note!,/No ar source/);
  assert.equal(calls.length,3);assert.ok(!calls.some(x=>x.includes('/49179/')));
 }finally{globalThis.fetch=real;if(old===undefined)delete process.env.DRAMATIP_LANGUAGE;else process.env.DRAMATIP_LANGUAGE=old;}
});
test('null descriptors remain explicit, authentication and unapproved-host errors are not swallowed',async()=>{
 await assert.rejects(()=>sourceFromDescriptor({descriptor:null}),/CLIPS_DESCRIPTOR_NULL/);
 await assert.rejects(()=>sourceFromDescriptor({descriptor:{chain:[{type:'hls',enc:encode('https://new-cdn.example/a.m3u8')}]}}),/CLIPS_MEDIA_HOST.*new-cdn.example/);
 const bytes=Buffer.from(encode('https://v.shortswave.com/a.m3u8'),'base64');bytes[18]^=1;
 await assert.rejects(()=>sourceFromDescriptor({descriptor:{chain:[{type:'hls',enc:bytes.toString('base64')}]}}),/CLIPS_DECRYPT/);
});
test('page-supplied sourceFirst fallback is used only for that episode, never a different title',async()=>{
 const real=globalThis.fetch,media='https://v.shortswave.com/first-only.m3u8';
 globalThis.fetch=(async(input:any)=>{
  const u=new URL(String(input));
  if(u.pathname.startsWith('/series/'))return new Response('<html lang="en">'+JSON.stringify({bookId:'inline123',sourceFirst:{chain:[{type:'hls',enc:encode(media)}]}})+'</html>');
  return Response.json({descriptor:null});
 }) as typeof fetch;
 try{
  assert.equal(await resolveDramaEpisode('drama:inline-case:1'),media);
  await assert.rejects(()=>resolveDramaEpisode('drama:inline-case:3'),/CLIPS_DESCRIPTOR_NULL.*episode 3/);
 }finally{globalThis.fetch=real;}
});
