import {decodeShortsSegment} from './shortsSegment';
import {observedDramaHosts} from './dramaMediaHosts';
import {Readable} from 'node:stream';
import {createDecipheriv, randomBytes} from 'node:crypto';
import type {Express} from 'express';
const KEY=Buffer.from('QC6Ir2trghxRAyyyWZEOEFR4GgLhnfQ4A19I3QBlQkc=','base64');
export function decodeDramaSource(enc:string):string {
 const raw=Buffer.from(enc,'base64');
 if(raw.length<29||raw.length>16384)throw new Error('Invalid episode source');
 const decipher=createDecipheriv('aes-256-gcm',KEY,raw.subarray(0,12));
 decipher.setAuthTag(raw.subarray(-16));
 let value:string;
 try{value=Buffer.concat([decipher.update(raw.subarray(12,-16)),decipher.final()]).toString('utf8');}catch{throw new Error('CLIPS_DECRYPT: The source could not be authenticated with the current DramaTip key.');}
 return safeDramaMediaUrl(value).href;
}
const exactHosts=new Set(['goodshort.goodbos.online','shortwave.goodbos.online','cdn2.nsstorage.space','v2-akm.goodreels.com']);
const hosts=['shortswave.com','crazymaplestudios.com','shorttv.live','goodshort.com','dramaboxdb.com','dramabox.com','netshort.com','mydramawave.com'];
export function safeDramaMediaUrl(value:string,base?:string,depth=0){
 if(depth>2)throw new Error("Nested media proxy is not supported");
 const u=new URL(value,base);
 const idramaKey=u.hostname==='api.idrama.video'&&u.pathname==='/shorts/open/drm/kds/api/v1/keys'&&/^[A-Za-z0-9_-]{1,32}$/.test(u.searchParams.get('source')||'')&&/^[a-f0-9]{32}$/i.test(u.searchParams.get('ak')||'')&&[...u.searchParams.keys()].every(k=>['source','ak'].includes(k));
 if(u.protocol!=='https:'||u.username||u.password||u.port||!(idramaKey||exactHosts.has(u.hostname)||u.hostname==='cdn.dramadizilerim.xyz'||observedDramaHosts.has(u.hostname)||hosts.some(h=>u.hostname===h||u.hostname.endsWith('.'+h))))throw new Error(`CLIPS_MEDIA_HOST: Unsupported HTTPS media host (${u.hostname}).`);
 if(['cdn.dramadizilerim.xyz','hls-proxy-i4ic7.b-cdn.net'].includes(u.hostname)){
  const nested=u.searchParams.get('url')||(u.hostname==='cdn.dramadizilerim.xyz'&&u.pathname.startsWith('/https/')?'https://'+u.pathname.slice(7)+u.search:null);
  if(!nested)throw new Error('Invalid provider media wrapper');
  safeDramaMediaUrl(nested,undefined,depth+1);
 }
 return u;
}
export function unwrapDramaMedia(value:string):string{
 const u=safeDramaMediaUrl(value);
 if(['cdn.dramadizilerim.xyz','hls-proxy-i4ic7.b-cdn.net'].includes(u.hostname))return unwrapDramaMedia(u.searchParams.get('url')||'https://'+u.pathname.slice(7)+u.search);
 return u.href;
}
export function providerMediaUrl(value:string,kind:string){
 const u=safeDramaMediaUrl(value);
 if(u.hostname==='video.joyreels.com')return u.href;
 if(['cdn.dramadizilerim.xyz','hls-proxy-i4ic7.b-cdn.net'].includes(u.hostname))return u.href;
 if(kind==='goodshort'&&/^acfs\d*\.goodreels\.com$/.test(u.hostname)){u.hostname='v2-akm.goodreels.com';return u.href;}
 if(['storyreel','dramawave','hls-enc'].includes(kind)||u.hostname==='media.tqshort.com'||u.hostname==='video.toonshort.com')return 'https://cdn.dramadizilerim.xyz/https/'+u.host+u.pathname+u.search;
 return u.href;
}
export async function sourceFromDescriptor(data:any):Promise<string>{
 if(!data?.descriptor)throw new Error('CLIPS_DESCRIPTOR_NULL: DramaTip returned no source for this episode and language.');
 const chain=data.descriptor.chain;
 if(!Array.isArray(chain)||!chain.length)throw new Error('CLIPS_CHAIN_EMPTY: The episode source contains no playback entries.');
 const errors:string[]=[];
 for(const entry of chain){
  if(entry?.type!=='hls'||typeof entry?.enc!=='string'){errors.push('CLIPS_FORMAT: The episode entry is not an encrypted HLS source.');continue;}
  try{return decodeDramaSource(entry.enc);}catch(e){errors.push(e instanceof Error?e.message:'CLIPS_SOURCE_INVALID');}
 }
 throw new Error([...new Set(errors)].join(' '));
}
// Each random URL belongs to one resolved source; callers cannot supply arbitrary proxy destinations.
const leases=new Map<string,{url:string;expires:number;key?:Buffer;subtitle:boolean}>();
export function mediaLease(value:string,keyBytes?:Buffer,subtitle=false):string{
 const url=safeDramaMediaUrl(value).href,now=Date.now();
 for(const [key,l]of leases)if(l.expires<now)leases.delete(key);
 // Reuse URLs so large playlists do not allocate duplicate entries on every reload.
 for(const [key,l]of leases)if(l.subtitle===subtitle&&l.url===url&&l.key?.toString('hex')===keyBytes?.toString('hex')){l.expires=now+30*60*1000;return '/api/clips/media/'+key;}
 if(leases.size>=5000)leases.delete(leases.keys().next().value!);
 const id=randomBytes(24).toString('hex');leases.set(id,{url,key:keyBytes,subtitle,expires:now+30*60*1000});return '/api/clips/media/'+id;
}
export function subtitleLease(url:string){const host=safeDramaMediaUrl(url).hostname;const wrapped=host==='cdn1.hahip.com'||host==='mydramawave.com'||host.endsWith('.mydramawave.com');return mediaLease(wrapped?providerMediaUrl(url,'dramawave'):url,undefined,true);}
export function normalizeSubtitle(value:string){const text=value.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();if(text.length>2_000_000)throw new Error('Subtitle file too large');if(/^WEBVTT(?:[ \t]|\n|$)/.test(text))return text+'\n';if(!/\d{1,2}:\d{2}:\d{2}[,.]\d{3}\s*-->/.test(text))throw new Error('Unsupported subtitle file');return 'WEBVTT\n\n'+text.replace(/(\d{1,2}:\d{2}:\d{2}),(\d{3})/g,'$1.$2')+'\n';}
export function rewriteDramaManifest(text:string,base:string,key?:Buffer){
 const wrapped=['cdn.dramadizilerim.xyz','hls-proxy-i4ic7.b-cdn.net'].includes(new URL(base).hostname),actual=unwrapDramaMedia(base);
 const child=(value:string)=>{const target=safeDramaMediaUrl(value,actual).href;return wrapped?providerMediaUrl(target,'storyreel'):target;};
 return text.split(/\r?\n/).map(line=>{
 if(!line.trim())return line;
 if(line.startsWith('#'))return line.replace(/URI="([^"]+)"/g,(_,v)=>`URI="${(v.startsWith('local://')||v.includes('offline-key'))?localKeyLease(key):mediaLease(child(v),key)}"`);
 return mediaLease(child(line.trim()),key);
 }).join('\n');
}
export async function dramaUpstream(url:string,range?:string,deadline?:number){
 const initial=safeDramaMediaUrl(url),wrapped=['cdn.dramadizilerim.xyz','hls-proxy-i4ic7.b-cdn.net'].includes(initial.hostname);
 const candidates=wrapped?[url,'https://hls-proxy-i4ic7.b-cdn.net/?url='+encodeURIComponent(unwrapDramaMedia(url)),unwrapDramaMedia(url)]:[url];
 let last:unknown;
 for(let attempt=0;attempt<candidates.length;attempt++){
  let current=candidates[attempt];
  try{for(let hops=0;hops<4;hops++){
   if(deadline!==undefined&&Date.now()>=deadline)throw Error('Episode lookup timed out. Retry.');
   const target=safeDramaMediaUrl(current).href;
   const original=new URL(target);const requestUrl=original.hostname==='api.idrama.video'?'https://dramatip.net/api/idrama-key?'+new URLSearchParams({source:original.searchParams.get('source')!,ak:original.searchParams.get('ak')!}):target;
   const r=await fetch(requestUrl,{redirect:'manual',signal:AbortSignal.timeout(Math.max(1,Math.min(wrapped&&attempt===0?8000:20000,deadline===undefined?20000:deadline-Date.now()))),headers:{'User-Agent':'Mozilla/5.0',...((/\.farsunpteltd\.(net|com)$/.test(new URL(target).hostname)||new URL(target).hostname==='cfts.kalostv.com')?{}:{Referer:'https://dramatip.net/'}),...(range?{Range:range}:{})}});
   if([301,302,303,307,308].includes(r.status)){const location=r.headers.get('location');await r.body?.cancel();if(!location)throw new Error('Missing media redirect');current=safeDramaMediaUrl(location,target).href;continue;}
   if(!r.ok&&attempt<candidates.length-1){await r.body?.cancel();throw Error('Provider media returned HTTP '+r.status);}
   return {r,url:target};
  }throw Error('Too many media redirects');}catch(e){last=e;}
 }
 throw last;
}
let goodShortKey:{bytes:Buffer;expires:number}|undefined;
async function publicGoodShortKey(){if(goodShortKey&&goodShortKey.expires>Date.now())return goodShortKey.bytes;const response=await fetch('https://dramatip.net/api/goodshort-key',{redirect:'error',headers:{Referer:'https://dramatip.net/','User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Provider playback key unavailable');const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length!==16)throw Error('Invalid provider playback key');goodShortKey={bytes,expires:Date.now()+300000};return bytes;}
const localKeys=new Map<string,{key:Buffer;expires:number}>();
function localKeyLease(key?:Buffer){if(!key)throw new Error('Missing provider playback key');for(const [id,v]of localKeys)if(v.expires<Date.now())localKeys.delete(id);if(localKeys.size>=5000)localKeys.delete(localKeys.keys().next().value!);const id=randomBytes(24).toString('hex');localKeys.set(id,{key,expires:Date.now()+1800000});return '/api/shorts/key/'+id;}
export function registerDramaMedia(app:Express){app.get('/api/shorts/key/:id',(req,res)=>{const entry=localKeys.get(req.params.id);if(!entry||entry.expires<Date.now())return res.status(410).end();res.setHeader('Cache-Control','no-store');res.type('application/octet-stream').send(entry.key);});app.get('/api/clips/media/:key',async(req,res)=>{
 const lease=leases.get(req.params.key);if(!lease||lease.expires<Date.now())return res.status(410).send('Episode link expired. Reload the episode.');
 lease.expires=Date.now()+30*60*1000;
 try{
 const range=req.headers.range;if(range&&!/^bytes=\d*-\d*$/.test(range))return res.status(416).end();
 const {r,url}=await dramaUpstream(lease.url,lease.subtitle?undefined:range);
 if(!r.ok){await r.body?.cancel();return res.status(502).send(`Episode media returned HTTP ${r.status}`);}
 if(!lease.subtitle&&r.body&&(r.headers.get('content-type')?.includes('video/mp4')||new URL(url).pathname.endsWith('.mp4'))){res.status(r.status).type('video/mp4');for(const name of ['content-range','content-length','accept-ranges']){const v=r.headers.get(name);if(v)res.setHeader(name,v);}const stream=Readable.fromWeb(r.body as any);res.on('close',()=>stream.destroy());stream.on('error',()=>res.destroy());stream.pipe(res);return;}
 const reader=r.body?.getReader();if(!reader)throw new Error('Empty media response');
 const chunks:Uint8Array[]=[];let size=0;
 for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>(lease.subtitle?2_000_000:24*1024*1024)){await reader.cancel();throw new Error('Media segment too large');}chunks.push(value);}
 const bytes=Buffer.concat(chunks),type=r.headers.get('content-type')||'';
 res.setHeader('Cache-Control','private, max-age=60');res.setHeader('X-Content-Type-Options','nosniff');
 if(lease.subtitle){res.type('text/vtt; charset=utf-8').send(normalizeSubtitle(bytes.toString('utf8')));return;}
 if(bytes.subarray(0,64).toString('utf8').replace(/^\uFEFF/,'').trimStart().startsWith('#EXTM3U')){
 // Use relative references: native builds resolve these against the HTTPS backend too.
 const text=bytes.toString('utf8').replace(/^\uFEFF/,'').trimStart();let key=lease.key;if(!key&&/URI="[^"]*(?:local:\/\/|offline-key)/.test(text)){const host=new URL(unwrapDramaMedia(url)).hostname;if(host!=='goodshort.goodbos.online'&&!/(^|\.)goodreels\.com$/.test(host))throw Error('Unsupported provider playback key');key=await publicGoodShortKey();}
 const manifest=rewriteDramaManifest(text,url,key);
 res.type('application/vnd.apple.mpegurl').send(manifest);
 }else{
 const decoded=decodeShortsSegment(bytes,unwrapDramaMedia(url));const isTs=decoded.length>188&&decoded[0]===0x47&&decoded[188]===0x47;const mediaType=isTs?'video/mp2t':type.includes('mpegurl')?'application/octet-stream':type||'application/octet-stream';
 res.status(r.status).type(mediaType);for(const key of ['content-range','accept-ranges']){const value=r.headers.get(key);if(value)res.setHeader(key,value);}res.send(decoded);
 }
 }catch{if(!res.headersSent)res.status(502).send('Episode media could not be loaded. Retry the episode.');}
 });}
