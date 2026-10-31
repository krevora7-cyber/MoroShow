import test from 'node:test';import assert from 'node:assert/strict';import {createCipheriv,randomBytes} from 'node:crypto';
import {safeDramaMediaUrl} from '../src/server/dramaPlayback';
import {resolveDramaEpisodeSource,sourceFromDramaEntry,dramaEpisodeSubtitles} from '../src/server/dramaSource';
import {captionMode,activeCaptionText,parseCaptionCues,captionAt} from '../src/player/shortsPresentation';
const encode=(url:string)=>{const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',Buffer.from('QC6Ir2trghxRAyyyWZEOEFR4GgLhnfQ4A19I3QBlQkc=','base64'),iv);return Buffer.concat([iv,c.update(url),c.final(),c.getAuthTag()]).toString('base64');};
const flight=(v:any)=>'<script>self.__next_f.push('+JSON.stringify([1,'1:'+JSON.stringify(v)+'\n'])+')</script>';
test('observed GoodShort playlists are supported while the relay remains closed to arbitrary hosts',()=>{
 const url='https://goodshort.goodbos.online/hls/123?bookId=456';assert.deepEqual(sourceFromDramaEntry({type:'goodshort',enc:encode(url)}),{url,streamType:'hls'});
 assert.equal(safeDramaMediaUrl('https://shortwave.goodbos.online/api/stream/a/b/v.m3u8').hostname,'shortwave.goodbos.online');
 for(const bad of ['https://other.goodbos.online/x','https://goodshort.goodbos.online.evil.test/x','http://goodshort.goodbos.online/x','https://user:pass@goodshort.goodbos.online/x','https://127.0.0.1/x'])assert.throws(()=>safeDramaMediaUrl(bad));
});
test('expired current media refreshes the exact episode and does not select nextSourceFirst',async()=>{
 const real=globalThis.fetch,slug='regression-expired-498',bookId='1234567890abcdef12345678',seen:string[]=[];
 const old={chain:[{type:'mp4',enc:encode('https://v.goodshort.com/expired.mp4')}]},fresh={chain:[{type:'mp4',enc:encode('https://v.goodshort.com/fresh.mp4')}]};
 globalThis.fetch=(async(input:any)=>{const u=new URL(String(input));seen.push(u.hostname+u.pathname);if(u.hostname==='dramatip.net'&&u.pathname.startsWith('/api/')){assert.match(u.pathname,new RegExp(bookId+'/2$'));return new Response(JSON.stringify({descriptor:fresh}));}if(u.hostname==='dramatip.net')return new Response(flight({slug,id:bookId,currentSerial:2,sourceFirst:old,nextSourceFirst:{type:'mp4',enc:encode('https://v.goodshort.com/wrong.mp4')}}));if(u.pathname==='/expired.mp4')return new Response('Expired',{status:403});if(u.pathname==='/fresh.mp4')return new Response(new Uint8Array([0,0,0,24,102,116,121,112]),{status:206});throw new Error('Unexpected request '+u.hostname+u.pathname);}) as typeof fetch;
 try{const result=await resolveDramaEpisodeSource('drama:'+slug+':2');assert.equal(result.url,'https://v.goodshort.com/fresh.mp4');assert.ok(!seen.some(x=>x.includes('wrong.mp4')));}finally{globalThis.fetch=real;}
});
test('subtitle discovery returns supplied languages only, bound to the same series and serial',async()=>{
 const real=globalThis.fetch,slug='regression-subtitles-498',bookId='abcdef1234567890abcdef12';const sub=(lang:string)=>({enc:encode('https://v.goodshort.com/'+lang+'.vtt'),language:lang});
 globalThis.fetch=(async(input:any)=>{const u=new URL(String(input));assert.equal(u.hostname,'dramatip.net');if(u.pathname.startsWith('/api/')){assert.ok(u.pathname.endsWith(bookId+'/3'));const lang=u.searchParams.get('lang')!;return new Response(JSON.stringify({descriptor:['en','ar','fr'].includes(lang)?{subtitle:sub(lang)}:null}));}return new Response(flight({slug,id:bookId,currentSerial:3,sourceFirst:{chain:[],subtitle:sub('en')}}));}) as typeof fetch;
 try{const tracks=await dramaEpisodeSubtitles('drama:'+slug+':3');assert.deepEqual(tracks.map(t=>t.lang).sort(),['ar','en','fr']);assert.equal(tracks.length,3);}finally{globalThis.fetch=real;}
});
test('one selected caption language is rendered once with stable seek timing',()=>{
 const cues=parseCaptionCues('WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n<b>Hello</b> &amp; مرحبا\n\n00:00:01.000 --> 00:00:03.000\nHello &amp; مرحبا\n');assert.equal(captionAt(cues,1.5),'Hello & مرحبا');assert.equal(captionAt(cues,3),'');assert.equal(captionMode(true,'fr',false,'fr'),'hidden');assert.equal(captionMode(true,'fr',true,'fr'),'showing');assert.equal(captionMode(true,'ar',false,'fr'),'disabled');
 assert.equal(activeCaptionText([{language:'fr',mode:'hidden',activeCues:[{text:'Bonjour'},{text:'Bonjour'}]},{language:'ar',mode:'disabled',activeCues:[{text:'ignored'}]}] as any,'fr'),'Bonjour');
});
