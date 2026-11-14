import type {Express} from 'express';
import {randomBytes} from 'node:crypto';
import {lookup} from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import {db} from './db';
const BASE='https://geil.to/live';
export const TV_GROUPS=[{id:'bein',name:'beIN Sports',badge:'beIN',search:'bein sports',group:'Arabia'},{id:'mbc',name:'MBC',badge:'MBC',search:'mbc'},{id:'osn',name:'OSN',badge:'OSN',search:'osn'},{id:'ssc',name:'SSC Sports',badge:'SSC',search:'ssc'},{id:'usa',name:'USA',badge:'🇺🇸',group:'USA'},{id:'france',name:'France',badge:'🇫🇷',group:'France'},{id:'arabia',name:'Arabia',badge:'🌍',group:'Arabia'},{id:'uk',name:'United Kingdom',badge:'🇬🇧',group:'United Kingdom'},{id:'all',name:'All channels',badge:'TV'}];
const channelIndex=new Map<string,any>();
const cache=new Map<string,{at:number;data:any}>();
export async function providerJson(path:string,signal?:AbortSignal){
 signal?.throwIfAborted();
 const hit=cache.get(path);if(hit&&Date.now()-hit.at<300000)return hit.data;
 const r=await fetch(BASE+path,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000),headers:{Accept:'application/json'}});if(!r.ok)throw new Error('TV provider is unavailable ('+r.status+').');
 const text=await r.text();if(text.length>5_000_000)throw new Error('TV response too large');const data=JSON.parse(text);
 if(cache.size>200)cache.delete(cache.keys().next().value!);cache.set(path,{at:Date.now(),data});return data;
}
export function publicChannel(item:any){
 if(!/^\d{1,16}$/.test(String(item.id)))return null;
 if(channelIndex.size>20000)channelIndex.clear();channelIndex.set(String(item.id),item);
 return {id:'geil:'+item.id,name:String(item.name||'Channel'),kind:'live',category:item.tags?.[0]||'TV',logoUrl:typeof item.image==='string'&&item.image.startsWith('https://')?item.image:undefined,streamUrl:'',streamType:'hls',isKidFriendly:false,epg:Array.isArray(item.epg)?item.epg:[]};
}
export function catalogPath(category:string,search:string,cursor:string){
 const g=TV_GROUPS.find(g=>g.id===category);const q=new URLSearchParams();q.set('sort','name');
 if(g&&'group'in g&&g.group)q.set('filter[group]',g.group);
 else if(category.startsWith('country:'))q.set('filter[group]',category.slice(8));
 if(category.startsWith('bein:')){q.set('filter[group]',category.includes(':tr:')?'Turkey':'Arabia');q.set('search','bein sports');}
 q.set('search',search||(category.startsWith('bein:')?(category.includes(':tr:')?'bein':'bein sports'):g&&'search'in g&&g.search)||'');if(cursor)q.set('cursor',cursor);
 return '/catalog/live/channels.json?'+q;
}
export function safeUrl(value:string,base?:string){const u=new URL(value,base);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.hostname.includes(':')||!u.hostname.includes('.')||/\.(local|internal|localhost)$/.test(u.hostname))throw new Error('Unsupported media address');return u;}
export function publicIp(ip:string){const a=ip.split('.').map(Number);if(a.length!==4||a.some(n=>!Number.isInteger(n)||n<0||n>255))return false;const[x,y]=a;return !(x===0||x===10||x===127||x>=224||x===169&&y===254||x===172&&y>=16&&y<=31||x===192&&[0,168].includes(y)||x===100&&y>=64&&y<=127||x===198&&[18,19].includes(y));}
export type OriginPolicy = { origin: string; mediaOrigins?: ReadonlySet<string>; redirects?: boolean };
export function mediaAddress(value:string,base?:string,policy?:OriginPolicy){
 const url=safeUrl(value,base);
 if(policy&&url.origin!==policy.origin&&!policy.mediaOrigins?.has(url.origin))throw new Error('Unapproved IPTV media origin');
 return url;
}
export async function upstream(value:string,signal:AbortSignal,range?:string,hops=0,policy?:OriginPolicy):Promise<{response:http.IncomingMessage;url:string}>{
 if(hops>4)throw new Error('Redirect limit');const u=mediaAddress(value,undefined,policy);signal.throwIfAborted();const addresses=await lookup(u.hostname,{family:4,all:true});if(!addresses.length||addresses.some(a=>!publicIp(a.address)))throw new Error('Private media address');signal.throwIfAborted();
 const response=await new Promise<http.IncomingMessage>((resolve,reject)=>{const req=(u.protocol==='https:'?https:http).get(u,{signal,headers:{'User-Agent':'Mozilla/5.0',...(range?{Range:range}:{})},lookup:((_h:any,o:any,cb:any)=>o.all?cb(null,[addresses[0]]):cb(null,addresses[0].address,4))as any},resolve);req.setTimeout(15000,()=>req.destroy(new Error('Source timed out')));req.on('error',reject);});
 if([301,302,303,307,308].includes(response.statusCode||0)){response.resume();if(policy?.redirects===false)throw new Error('Unexpected redirect');return upstream(mediaAddress(response.headers.location||'',u.href,policy).href,signal,range,hops+1,policy);}return {response,url:u.href};
}
// Only compare renditions of the SAME named channel and country. Never substitute
// a different sport, channel number, Premium/Max/AFC feed, or language.
export function channelFamily(name:string){return name.toUpperCase().replace(/\(\d+\)\s*$/,'').replace(/\(BACKUP(?: \d+)?\)/g,'').replace(/\b(?:FHD|UHD|HD|HQ|SD|HEVC|H264|H265|LOW|LOCAL|\d+[KM]B|\d{3,4}P)\b/g,'').replace(/\s+/g,' ').trim();}
export function sameChannel(a:any,b:any){return a.id!==b.id&&a.tags?.[0]===b.tags?.[0]&&channelFamily(a.name)===channelFamily(b.name);}
export async function readManifest(url:string,signal:AbortSignal,policy?:OriginPolicy){
 const {response:r,url:finalUrl}=await upstream(url,signal,undefined,0,policy);try{
 if(r.statusCode!==200)throw new Error('Source HTTP '+r.statusCode);
 const chunks:Buffer[]=[];let bytes=0;for await(const c of r){bytes+=c.length;if(bytes>2_000_000)throw new Error('Manifest too large');chunks.push(c);}
 const text=Buffer.concat(chunks).toString().replace(/^\uFEFF/,'').trimStart();if(!text.startsWith('#EXTM3U'))throw new Error('Source did not return an HLS playlist');return {text,url:finalUrl};
 }finally{r.destroy();}
}
export async function probeStream(url:string,signal:AbortSignal,policy?:OriginPolicy){
 let manifest=await readManifest(url,signal,policy);for(let depth=0;depth<3;depth++){
 const lines=manifest.text.split(/\r?\n/);const uri=lines.find(l=>l.trim()&&!l.startsWith('#'));if(!uri)throw new Error('Empty live playlist');
 const next=mediaAddress(uri.trim(),manifest.url,policy).href;
 if(manifest.text.includes('#EXT-X-STREAM-INF:')){manifest=await readManifest(next,signal,policy);continue;}
 // Check media bytes, not just a catalogue entry or an HTTP-200 error page.
 const {response:r}=await upstream(next,signal,'bytes=0-1023',0,policy);try{
 if(![200,206].includes(r.statusCode||0))throw new Error('Segment unavailable');
 const type=String(r.headers['content-type']||'');const first=await r[Symbol.asyncIterator]().next();const data=Buffer.from(first.value||'');
 if(!data.length||/text\/|json/i.test(type)||/^\s*</.test(data.subarray(0,32).toString()))throw new Error('Source returned no video');return;
 }finally{r.destroy();}
 }throw new Error('Nested playlist limit');
}
async function resolveChecked(id:string,signal:AbortSignal){
 const r=await fetch(BASE+'/resolve?'+new URLSearchParams({url:BASE+'/play/'+id}),{signal,headers:{Accept:'application/json'}});
 if(!r.ok)throw new Error('Resolver unavailable');const d=await r.json();if(typeof d.url!=='string')throw new Error('No stream');
 if(d.format&&d.format!=='hls')throw new Error('Unsupported live format');await probeStream(d.url,signal);return d;
}
export async function chooseWorkingChannel(id:string,excluded:string[],signal:AbortSignal,dependencies={catalog:providerJson,resolve:resolveChecked}){
 signal.throwIfAborted();
 const tried=new Set(excluded.slice(0,12));const item=channelIndex.get(id);const candidates=[id];
 if(item){
 // Search the provider for renditions even when the alternate is on another page.
 const q=new URLSearchParams({search:channelFamily(item.name),'filter[group]':item.tags?.[0]||'',sort:'name'});
 try{const data=await dependencies.catalog('/catalog/live/channels.json?'+q,signal);for(const c of data.items||[])publicChannel(c);}catch{/* The already loaded catalogue remains usable. */}
 candidates.push(...[...channelIndex.values()].filter(c=>sameChannel(item,c)).sort((a,b)=>Number(/HEVC|H265|UHD/.test(a.name))-Number(/HEVC|H265|UHD/.test(b.name))).map(c=>String(c.id)));
 }
 let choices=[...new Set(candidates)].filter(c=>!tried.has(c)).slice(0,6);
 // A channel with a single feed may only need a fresh expiring URL.
 if(!choices.length){tried.delete(id);choices=[id];}
 // Do not open multiple renditions concurrently: IPTV accounts can have
 // a one-connection limit, so racing feeds can interrupt otherwise healthy TV.
 for(const candidate of choices.slice(0,3)){
  signal.throwIfAborted();tried.add(candidate);
  try{const d=await dependencies.resolve(candidate,AbortSignal.any([signal,AbortSignal.timeout(20000)]));return {data:d,sourceId:candidate,attemptedIds:[...tried]};}catch{signal.throwIfAborted();}
 }

 throw new Error('No working source for this channel was reachable. Please retry later.');
}
const leases=new Map<string,{url:string;until:number;policy?:OriginPolicy;key:string}>();const keys=new Map<string,string>();
export function lease(value:string,policy?:OriginPolicy){const url=mediaAddress(value,undefined,policy).href;const key=JSON.stringify([url,policy?.origin,policy?.redirects,...(policy?.mediaOrigins??[])]);const old=keys.get(key);if(old&&leases.has(old)){leases.get(old)!.until=Date.now()+3600000;return '/api/live/media/'+old;}
 if(leases.size>=10000){for(const [id,v]of leases){if(v.until<Date.now()||leases.size>=9000){leases.delete(id);keys.delete(v.key);}}}
 const id=randomBytes(24).toString('hex');leases.set(id,{url,until:Date.now()+3600000,policy,key});keys.set(key,id);return '/api/live/media/'+id;
}
export function rewrite(text:string,base:string,policy?:OriginPolicy){return text.split(/\r?\n/).map(line=>!line.trim()?line:line.startsWith('#')?line.replace(/URI="([^"]+)"/g,(_,u)=>`URI="${lease(mediaAddress(u,base,policy).href,policy)}"`):lease(mediaAddress(line.trim(),base,policy).href,policy)).join('\n');}
export function registerGeilTv(app:Express,mediaOnly=false){
 app.use('/api/live',(req,res,next)=>{if(req.path.startsWith('/media/'))return next();const id=String(req.query.profileId||req.body?.profileId||'');const p=db.getProfileById(id);if(!p)return res.status(401).json({success:false,error:'Select a profile first.'});if(p.isKid)return res.status(403).json({success:false,error:'Live TV is not available in Kids profiles.'});next();});
 if(!mediaOnly){
 app.get('/api/live/channels',async(req,res)=>{try{
 const cat=String(req.query.category||'bein').slice(0,100),search=String(req.query.search||'').trim().slice(0,80),cursor=String(req.query.cursor||'');if(cursor&&!/^\d{1,8}$/.test(cursor))return res.status(400).json({success:false,error:'Invalid page'});
 const data=await providerJson(catalogPath(cat,search,cursor));let items=(data.items||[]).map(publicChannel).filter(Boolean);if(cat==='bein'||cat.startsWith('bein:'))items=items.filter((i:any)=>cat.includes(':tr:')?/bein/i.test(i.name):/bein\s*sports?/i.test(i.name));if(cat.startsWith('bein:')){const quality=cat.split(':')[2];items=items.filter((i:any)=>quality==='all'||quality==='sd'?quality==='all'||/\bSD\b|\bLOW\b/i.test(i.name):quality==='fhd'?/\bFHD\b|\bUHD\b/i.test(i.name):/\bHD\b|\bHQ\b/i.test(i.name));}
 const preset=TV_GROUPS.find(g=>g.id===cat);if(search&&preset&&'search'in preset)items=items.filter((i:any)=>i.name.toLowerCase().includes(preset.search!));
 const countries=(data.features?.filter?.find((f:any)=>f.id==='group')?.values||[]).map((v:any)=>({id:'country:'+v.id,name:v.name,badge:String(v.name).slice(0,2).toUpperCase()}));
 // Some providers ignore unknown group filters. Never populate USA with another country.
 if(cat==='usa')items=items.filter((i:any)=>/^(usa|united states|united states of america)$/i.test(i.category));
 res.json({success:true,items,nextCursor:cat==='usa'&&!countries.some((g:any)=>/USA|United States/i.test(g.name))?null:data.nextCursor??null,groups:[...TV_GROUPS,...["ar","tr"].flatMap(country=>["all","hd","fhd","sd"].map(quality=>({id:`bein:${country}:${quality}`,name:`beIN ${country==='ar'?'Arabia':'Turkey'} · ${quality.toUpperCase()}`,badge:'TV'}))),...countries.filter((c:any)=>!TV_GROUPS.some(g=>g.name===c.name))]});
 }catch(e:any){res.status(502).json({success:false,error:e.message||'Unable to load channels.'});}});
 app.post('/api/live/play',async(req,res)=>{try{const id=String(req.body.contentId||'').replace(/^geil:/,'');if(!/^\d{1,16}$/.test(id))return res.status(400).json({success:false,error:'Invalid channel'});
 const excluded=Array.isArray(req.body.excludeIds)?req.body.excludeIds.filter((v:any)=>typeof v==='string'&&/^\d{1,16}$/.test(v)).slice(0,12):[];
 const c=new AbortController();const closed=()=>c.abort();res.once('close',closed);
 try{const result=await chooseWorkingChannel(id,excluded,AbortSignal.any([c.signal,AbortSignal.timeout(65000)]));
 if(!c.signal.aborted)res.json({success:true,streamUrl:lease(result.data.url),streamType:'hls',name:result.data.name||'',sourceId:result.sourceId,attemptedIds:result.attemptedIds,usedAlternative:result.sourceId!==id,token:randomBytes(12).toString('hex')});
 }finally{res.off('close',closed);}

 }catch(e:any){res.status(502).json({success:false,error:e.message||'Channel unavailable.'});}});
 }
 app.get('/api/live/media/:id',async(req,res)=>{const v=leases.get(req.params.id);if(!v||v.until<Date.now())return res.status(410).send('Stream expired. Retry the channel.');v.until=Date.now()+3600000;const c=new AbortController();res.on('close',()=>c.abort());
 try{const range=req.headers.range;if(range&&!/^bytes=\d*-\d*$/.test(range))return res.status(416).end();const{response:r,url}=await upstream(v.url,c.signal,range,0,v.policy);if((r.statusCode||500)>=400){r.destroy();return res.status(502).send('Channel source unavailable');}res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const it=r[Symbol.asyncIterator](),first=await it.next(),chunk=Buffer.from(first.value||''),type=String(r.headers['content-type']||'');
 if(type.includes('mpegurl')||new URL(url).pathname.endsWith('.m3u8')||chunk.subarray(0,7).toString()==='#EXTM3U'){
 const chunks=[chunk];let bytes=chunk.length;while(true){const p=await it.next();if(p.done)break;bytes+=p.value.length;if(bytes>2_000_000){r.destroy();throw new Error('Manifest too large');}chunks.push(p.value);}res.type('application/vnd.apple.mpegurl').send(rewrite(Buffer.concat(chunks).toString(),url,v.policy));
 }else{if(type.includes('text/html')){r.destroy();throw new Error('Not video');}res.status(r.statusCode||200).type(type||'application/octet-stream');for(const h of ['content-range','content-length','accept-ranges'])if(r.headers[h])res.setHeader(h,r.headers[h]!);if(chunk.length)res.write(chunk);while(!c.signal.aborted){const p=await it.next();if(p.done)break;if(!res.write(p.value))await new Promise<void>(resolve=>{const done=()=>{res.off('drain',done);res.off('close',done);resolve();};res.once('drain',done);res.once('close',done);});}res.end();}
 }catch{if(!res.headersSent)res.status(502).send('Live stream unavailable. Retry or select another channel.');else res.destroy();}});
}
