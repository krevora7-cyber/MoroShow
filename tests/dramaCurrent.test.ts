import {normalizeSubtitle} from '../src/server/dramaPlayback';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCipheriv,randomBytes} from 'node:crypto';
import express from 'express';
import {parseDramaPageUrl,dramaEpisodeUrl,readDramaPlayer,sourceFromDramaEntry,dramaSeriesId} from '../src/server/dramaSource';
import {registerWebSources} from '../src/server/webSources';
import {db} from '../src/server/db';
const DRAMA_TEST_EPISODE={id:dramaSeriesId('نهوض-الزوج-العبقري','ar')+':21'};
const slug='نهوض-الزوج-العبقري';
const flight=(value:any)=>'<script>self.__next_f.push('+JSON.stringify([1,'1:'+JSON.stringify(value)+'\n'])+')</script>';
test('Arabic episode URLs round-trip and reject other hosts or unsafe paths',()=>{
 const url='https://dramatip.net/ar/series/'+encodeURIComponent(slug)+'/episode-21';const d=parseDramaPageUrl(url);
 assert.equal(d.id,dramaSeriesId(slug,'ar'));assert.equal(d.episode,21);assert.equal(dramaEpisodeUrl(d.id+':21'),url);
 for(const bad of ['https://evil.test/ar/series/story/episode-21','https://dramatip.net/series/../secret','https://user:pass@dramatip.net/series/story','https://dramatip.net/series/story?url=https://evil.test'])assert.throws(()=>parseDramaPageUrl(bad));
});
test('current page source is bound to the exact slug and episode, never its next source',()=>{
 const source={chain:[{type:'mp4',enc:'current'}]};const h=flight({slug,currentSerial:21,sourceFirst:source,nextSourceFirst:{enc:'next',type:'mp4'}});
 assert.deepEqual(readDramaPlayer(h,slug,21).sourceFirst,source);assert.equal(readDramaPlayer(h,slug,22),undefined);assert.equal(readDramaPlayer(h,'other',21),undefined);
});
test('authenticated MP4 source keeps its actual format and limits media hosts',()=>{
 const encode=(url:string)=>{const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',Buffer.from('QC6Ir2trghxRAyyyWZEOEFR4GgLhnfQ4A19I3QBlQkc=','base64'),iv);return Buffer.concat([iv,c.update(url),c.final(),c.getAuthTag()]).toString('base64');};
 const url='https://ns-aws-cdn.netshort.com/video?auth_key=test';assert.deepEqual(sourceFromDramaEntry({type:'mp4',enc:encode(url)}),{url,streamType:'mp4'});
 assert.throws(()=>sourceFromDramaEntry({type:'mp4',enc:encode('https://127.0.0.1/private')}));assert.throws(()=>sourceFromDramaEntry({type:'iframe',enc:encode(url)}));
});
test('episode token delivers Arabic subtitles via the media relay as WebVTT',async()=>{
 const real=globalThis.fetch;const encode=(url:string)=>{const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',Buffer.from('QC6Ir2trghxRAyyyWZEOEFR4GgLhnfQ4A19I3QBlQkc=','base64'),iv);return Buffer.concat([iv,c.update(url),c.final(),c.getAuthTag()]).toString('base64');};
 const vtt='WEBVTT\n\n00:00:06.041 --> 00:00:08.291\nترجمة عربية للاختبار\n';
 globalThis.fetch=(async(input:any,init:any)=>{const u=new URL(String(input));if(u.hostname==='dramatip.net'&&!u.pathname.includes('/episode-'))return new Response('<h1>Story</h1><a href="/ar/series/'+encodeURIComponent(slug)+'/episode-21">21</a><a href="/ar/series/'+encodeURIComponent(slug)+'/episode-22">22</a>');if(u.hostname==='dramatip.net')return new Response(flight({slug,currentSerial:21,sourceFirst:{chain:[{type:'mp4',enc:encode('https://ns-aws-cdn.netshort.com/video')}],subtitle:{enc:encode('https://ns-aws-cdn.netshort.com/subtitle'),language:'ar_AE',format:'webvtt'}}}));if(u.hostname==='ns-aws-cdn.netshort.com'&&u.pathname==='/video')return new Response(new Uint8Array([0,0,0,24,102,116,121,112]),{status:206,headers:{'Content-Type':'video/mp4'}});if(u.hostname==='ns-aws-cdn.netshort.com'&&u.pathname==='/subtitle')return new Response(vtt,{headers:{'Content-Type':'text/vtt'}});return real(input,init);}) as typeof fetch;
 const app=express();app.use(express.json());registerWebSources(app);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as any).port}`;
 try{const profile=db.getProfiles().find(p=>!p.isKid)!;const token=await (await real(base+'/api/stream/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profileId:profile.id,contentId:DRAMA_TEST_EPISODE.id,variantId:'dramatip'})})).json();assert.equal(token.success,true);assert.equal(token.subtitles.length,1);const s=token.subtitles[0];assert.equal(s.lang,'ar-AE');assert.match(s.label,/Arabic/);assert.match(s.url,/^\/api\/clips\/media\//);const response=await real(base+s.url);assert.equal(response.status,200);assert.match(response.headers.get('content-type')||'',/text\/vtt/);assert.equal(await response.text(),vtt);
 }finally{globalThis.fetch=real;server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});

test('catalog defaults to English while keeping independent episode identities',async()=>{
 const real=globalThis.fetch;const seen:string[]=[];const a=dramaSeriesId('story-one'),b=dramaSeriesId('story-two');
 globalThis.fetch=(async(input:any,init:any)=>{const u=new URL(String(input));if(u.hostname!=='dramatip.net')return real(input,init);seen.push(decodeURIComponent(u.pathname));if(u.pathname.includes('/series/')){const title=decodeURIComponent(u.pathname).split('/').pop();return new Response('<h1>'+title+'</h1>'+[1,2,3].map(n=>'<a href="/series/'+title+'/episode-'+n+'">'+n+'</a>').join(''));}const slug=u.pathname.endsWith('/2')?'story-two':'story-one';return new Response('<a href="/series/'+slug+'"><img alt="'+slug+'" src="https://example.test/cover.jpg"></a><a href="/category/popular/page/2">2</a>');}) as typeof fetch;
 const app=express();app.use(express.json());registerWebSources(app);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as any).port}`;const profile=db.getProfiles().find(p=>!p.isKid)!;
 try{const first=await (await real(`${base}/api/web-sources/clips?profileId=${profile.id}&category=popular&page=1`)).json();assert.deepEqual(first.items.map((i:any)=>i.id),[a]);assert.equal(first.hasMore,true);const second=await (await real(`${base}/api/web-sources/clips?profileId=${profile.id}&category=popular&page=2`)).json();assert.deepEqual(second.items.map((i:any)=>i.id),[b]);assert.equal(second.hasMore,false);assert.ok(seen.includes('/category/popular'));assert.ok(seen.includes('/category/popular/page/2'));const eps=await (await real(`${base}/api/series/${encodeURIComponent(b)}/episodes?profileId=${profile.id}`)).json();assert.deepEqual(eps.episodes.map((i:any)=>i.episode),[1,2,3]);assert.ok(eps.episodes.every((i:any)=>i.id.startsWith(b+':')));
 }finally{globalThis.fetch=real;server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});

test('Arabic SRT and BOM-prefixed WebVTT normalize without altering cue text or timing',()=>{const srt='1\r\n00:00:06,041 --> 00:00:08,291\r\nترجمة عربية\r\n';assert.equal(normalizeSubtitle(srt),'WEBVTT\n\n1\n00:00:06.041 --> 00:00:08.291\nترجمة عربية\n');assert.equal(normalizeSubtitle('\uFEFFWEBVTT\n\n00:00:01.000 --> 00:00:02.000\nأهلا'),'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nأهلا\n');assert.throws(()=>normalizeSubtitle('<html>Access denied</html>'));});
