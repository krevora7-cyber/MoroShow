import {dramaFlightRecords,resolveDramaFlight} from './dramaFlight';
import {load} from 'cheerio';
import type {CatalogItem,StreamType} from '../types';
import {decodeDramaSource,dramaUpstream,providerMediaUrl,safeDramaMediaUrl,unwrapDramaMedia} from './dramaPlayback';
export {parseDramaBookId} from './dramaSource.legacy';
import {parseDramaBookId} from './dramaSource.legacy';
const origin='https://dramatip.net';
const cache=new Map<string,{expires:number;html:string}>(),pending=new Map<string,Promise<string>>();
const languages=['en','ar','fr','es','de','pt','id','ja','ko','th','vi','it','ru','tl','hi','ms'];
function language(value:string){if(!languages.includes(value))throw new Error('Unsupported DramaTip language');return value;}
const prefix=(lang:string)=>lang==='en'?'':'/'+language(lang);
function validSlug(value:string){if(!/^[\p{L}\p{M}\p{N}_-]{1,300}$/u.test(value))throw new Error('Invalid series path');return value;}
export function dramaSeriesId(slug:string,lang='en'){validSlug(slug);language(lang);return 'drama:'+(lang==='en'&&/^[\w-]+$/.test(slug)?slug:lang+'~'+Buffer.from(slug).toString('base64url'));}
export function parseDramaIdentity(id:string){const m=/^drama:([^:]+)(?::([1-9]\d{0,4}))?$/.exec(id);if(!m)throw new Error('Invalid short drama');const [lang,encoded]=m[1].includes('~')?m[1].split('~'):['en',undefined];const slug=encoded?Buffer.from(encoded,'base64url').toString():m[1];validSlug(slug);language(lang);return {slug,language:lang,episode:m[2]?Number(m[2]):undefined,seriesId:dramaSeriesId(slug,lang)};}
export function parseDramaPageUrl(value:string){const u=new URL(value);if(u.origin!==origin||u.username||u.password||u.search||u.hash)throw new Error('Paste a DramaTip series or episode URL');const path=decodeURIComponent(u.pathname);const m=/^(?:\/([a-z]{2}))?\/series\/([^/]+)(?:\/episode-([1-9]\d{0,4}))?\/?$/.exec(path);if(!m)throw new Error('Paste a DramaTip series or episode URL');const lang=m[1]||'en',id=dramaSeriesId(m[2],lang);return {id,episode:m[3]?Number(m[3]):undefined,language:lang};}
export function dramaEpisodeUrl(id:string){const d=parseDramaIdentity(id);if(!d.episode)throw new Error('Select an episode');return `${origin}${prefix(d.language)}/series/${encodeURIComponent(d.slug)}/episode-${d.episode}`;}
async function html(path:string,fresh=false,budgetMs=20000){const hit=cache.get(path);if(!fresh&&hit&&hit.expires>Date.now())return hit.html;const key=path+(fresh?'#fresh':'');if(!pending.has(key))pending.set(key,(async()=>{const r=await fetch(origin+path,{redirect:'error',headers:{'User-Agent':'Mozilla/5.0',Accept:'text/html'},signal:AbortSignal.timeout(Math.max(1,Math.min(20000,budgetMs)))});if(!r.ok)throw new Error(`DramaTip returned HTTP ${r.status}`);const h=await r.text();if(h.length>5_000_000)throw new Error('DramaTip response too large');if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(path,{html:h,expires:Date.now()+120000});return h;})().finally(()=>pending.delete(key)));return pending.get(key)!;}
function picture(raw?:string){if(!raw)return;try{const u=new URL(raw,origin);if(u.protocol==='https:'){if(u.searchParams.has('w'))u.searchParams.set('w','500');return u.href;}}catch{}}
function item(slug:string,name:string,image?:string,lang='en'):CatalogItem{return {id:dramaSeriesId(slug,lang),name,seriesTitle:name,kind:'series',category:'Shorts',streamUrl:'',streamType:'hls',isKidFriendly:false,logoUrl:picture(image),backdropUrl:picture(image)};}
export function parseDramaCatalog(h:string){const $=load(h),items=new Map<string,CatalogItem>();$('a[href]').each((_,el)=>{const a=$(el);try{const u=new URL(a.attr('href')||'',origin);if(u.origin!==origin)return;const d=parseDramaPageUrl(u.href);if(d.episode)return;const image=a.find('img').first(),name=image.attr('alt')||a.find('h2,h3').first().text();if(image.length&&name.trim()){const id=parseDramaIdentity(d.id);items.set(d.id,item(id.slug,name.trim(),image.attr('src'),id.language));}}catch{}});return [...items.values()];}
export async function dramaCatalog(page:number,category:string,q:string,lang='en'){if(!/^[a-z0-9-]+$/.test(category)||!Number.isSafeInteger(page)||page<1||page>500)throw new Error('Invalid category or page');const categories:Record<string,string> = lang==='ar'?{'popular':'populer','new-releases':'newly-added','romance':'romantik','revenge':'revenge'}:{'popular':'popular','new-releases':'new-releases','romance':'romance','revenge':'revenge'};const nativeCategory=categories[category];if(!nativeCategory)throw new Error('Invalid category');const path=prefix(lang)+(q?'/search?'+new URLSearchParams({q,page:String(page)}):`/category/${nativeCategory}${page>1?'/page/'+page:''}`);const h=await html(path),$=load(h),next=q?`page=${page+1}`:`/page/${page+1}`;return {items:parseDramaCatalog(h),page,hasMore:$('a[href]').toArray().some(a=>($(a).attr('href')||'').includes(next))};}
export function dramaSourceSerial(player:any,displayEpisode:number){return player?.firstSerial===0?displayEpisode-1:displayEpisode;}
export function readDramaPlayer(h:string,slug:string,episode:number){
 const records=dramaFlightRecords(h);let found:any;
 function visit(v:any,depth=0){if(!v||typeof v!=='object'||depth>55)return;if(Object.hasOwn(v,'sourceFirst')&&v.slug===slug&&Number(v.currentSerial)===dramaSourceSerial(v,episode))found=v;for(const x of Object.values(v))if(x&&typeof x==='object')visit(x,depth+1);}
 for(const value of records.values())visit(value);
 return found?resolveDramaFlight(found,records):undefined;
}
export function parseDramaDetails(h:string,slug:string,lang='en'){const $=load(h);let meta:any={};$('script[type="application/ld+json"]').each((_,el)=>{try{const d=JSON.parse($(el).text()),nodes=d['@graph']||[d],match=nodes.find((n:any)=>n['@type']==='TVSeries');if(match)meta=match;}catch{}});const parent=item(slug,meta.name||$('h1').first().text().trim()||slug,typeof meta.image==='string'?meta.image:$('meta[property="og:image"]').attr('content'),lang);parent.overview=meta.description||$('meta[name="description"]').attr('content')||'';const episodes=new Map<number,CatalogItem>();$('a[href]').each((_,el)=>{try{const u=new URL($(el).attr('href')||'',origin),d=parseDramaPageUrl(u.href),id=parseDramaIdentity(d.id);if(id.slug!==slug||id.language!==lang||!d.episode)return;episodes.set(d.episode,{...parent,id:parent.id+':'+d.episode,name:`Episode ${d.episode}`,season:1,episode:d.episode});}catch{}});return {item:parent,episodes:[...episodes.values()].sort((a,b)=>a.episode!-b.episode!)};}
export async function dramaDetails(id:string){const d=parseDramaIdentity(id);return parseDramaDetails(await html(`${prefix(d.language)}/series/${encodeURIComponent(d.slug)}`),d.slug,d.language);}
export function sourceFromDramaEntry(entry:any):{url:string;streamType:StreamType}{
 if(!entry||typeof entry.enc!=='string'||!['mp4','hls','dramawave','goodshort','storyreel','hls-enc'].includes(entry.type))throw new Error('Unsupported DramaTip video format');
 const url=providerMediaUrl(decodeDramaSource(entry.enc),entry.type),path=new URL(url).pathname.toLowerCase();return {url,streamType:entry.type==='mp4'||path.endsWith('.mp4')?'mp4':'hls'};
}
function descriptorSource(descriptor:any){if(!descriptor?.chain?.length)throw new Error('DramaTip returned no playback source');let last:unknown;for(const entry of descriptor.chain){try{return sourceFromDramaEntry(entry);}catch(e){last=e;}}throw last;}
export function descriptorSubtitles(descriptor:any,lang:string){
 const subtitles:{url:string;lang:string;label:string}[]=[];
 const entries=[descriptor?.subtitle,...(Array.isArray(descriptor?.subtitles)?descriptor.subtitles:[])].filter(Boolean);
 for(const sub of entries){if(typeof sub.enc!=='string')continue;try{
  const url=decodeDramaSource(sub.enc),code=String(sub.language||lang).replace(/_/g,'-');
  if(!/^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(code))continue;
  let label=code;try{label=new Intl.DisplayNames(['en'],{type:'language'}).of(code)||code;}catch{}
  if(!subtitles.some(s=>s.lang===code&&s.url===url))subtitles.push({url,lang:code,label});
 }catch{/* A missing or unsupported subtitle must not prevent video playback. */}}
 return subtitles;
}
function currentPlayerBookId(player:any){return typeof player?.bookId==='string'&&/^[\p{L}\p{M}\p{N}_-]{1,300}$/u.test(player.bookId)?player.bookId:undefined;}
async function episodeApi(bookId:string,episode:number,lang:string,pageUrl:string,timeout=15000){
 const r=await fetch(`${origin}/api/episode-source/${encodeURIComponent(bookId)}/${episode}?lang=${language(lang)}&refresh=1`,{redirect:'error',headers:{Referer:pageUrl,Accept:'application/json','User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(timeout)});
 if(!r.ok)throw new Error(`Shorts episode source returned HTTP ${r.status}`);
 return (await r.json()).descriptor;
}
export async function probeDramaSource(url:string,streamType?:StreamType,depth=0,seen=new Set<string>(),deadline?:number){
 const identity=unwrapDramaMedia(url);if(seen.has(identity))throw Error("Episode source repeats a playlist instead of video");const visited=new Set([...seen,identity]);
 const expectedManifest=streamType==='hls'||new URL(unwrapDramaMedia(url)).pathname.endsWith('.m3u8');
 const {r,url:finalUrl}=await dramaUpstream(url,expectedManifest?undefined:'bytes=0-1023',deadline);
 if(!r.ok){await r.body?.cancel();throw new Error(`Episode source returned HTTP ${r.status}`);}
 const reader=r.body?.getReader();if(!reader)throw new Error('Episode source was empty');
 const chunks:Uint8Array[]=[];let size=0;
 for(;;){const part=await reader.read();if(part.done)break;chunks.push(part.value);size+=part.value.length;if(!expectedManifest||size>512000){await reader.cancel();break;}}
 if(!size)throw new Error('Episode source was empty');if(size>512000&&expectedManifest)throw Error('Episode playlist too large');
 const text=Buffer.concat(chunks).toString('utf8').trimStart();
 if(/^(?:<!doctype|<html)/i.test(text))throw new Error('Episode source returned a page instead of video');
 if(text.startsWith('#EXTM3U')){
  if(depth>=3)throw Error('Episode playlists did not lead to media');
  const line=text.split(/\r?\n/).find(l=>l.trim()&&!l.startsWith('#'));if(!line)throw Error('Episode playlist contains no media');
  const child=safeDramaMediaUrl(line.trim(),unwrapDramaMedia(finalUrl)).href;
  const wrapped=['cdn.dramadizilerim.xyz','hls-proxy-i4ic7.b-cdn.net'].includes(new URL(finalUrl).hostname);
  await probeDramaSource(wrapped?providerMediaUrl(child,'storyreel'):child,undefined,depth+1,visited,deadline);
 }
}
export async function resolveDramaEpisodeSource(id:string,verify=true){
 const d=parseDramaIdentity(id);if(!d.episode)throw new Error('Select an episode');
 const deadline=Date.now()+40000;const remaining=()=>{const ms=deadline-Date.now();if(ms<=0)throw Error('Episode lookup timed out. Retry.');return ms;};
 const pageUrl=dramaEpisodeUrl(id),h=await html(new URL(pageUrl).pathname,true,remaining()),player=readDramaPlayer(h,d.slug,d.episode);
 let last:unknown=new Error('No playback source was supplied for this episode');
 const resolve=async(descriptor:any)=>{
  for(const entry of descriptor?.chain||[]){try{const result=sourceFromDramaEntry(entry);if(verify)await probeDramaSource(result.url,result.streamType,0,new Set(),deadline);return {...result,language:d.language,requestedLanguage:d.language,subtitles:descriptorSubtitles(descriptor,d.language)};}catch(e){last=e;}}
  return null;
 };
 // Never use nextSourceFirst or another episode's props.
 const initial=await resolve(player?.sourceFirst);if(initial)return initial;
 try{
  const bookId=currentPlayerBookId(player)||parseDramaBookId(await html(`${prefix(d.language)}/series/${encodeURIComponent(d.slug)}`,false,remaining()),d.slug);
  const fresh=await resolve(await episodeApi(bookId,dramaSourceSerial(player,d.episode),d.language,pageUrl,Math.min(15000,remaining())));if(fresh)return fresh;
 }catch(e){last=e;}
 throw new Error(`This episode is temporarily unavailable. ${last instanceof Error?last.message:'Try again later.'}`);
}
function unresolvedSubtitle(descriptor:any){
 return [descriptor?.subtitle,...(Array.isArray(descriptor?.subtitles)?descriptor.subtitles:[])].some(sub=>{
  if(!sub?.enc)return false;try{decodeDramaSource(sub.enc);return false;}catch{return true;}
 });
}
type SubtitleTrack={url:string;lang:string;label:string};
const subtitleCache=new Map<string,{expires:number;tracks:SubtitleTrack[];complete:boolean}>();
export async function discoverDramaEpisodeSubtitles(id:string){
 const hit=subtitleCache.get(id);if(hit&&hit.expires>Date.now())return {tracks:hit.tracks,complete:hit.complete};
 const d=parseDramaIdentity(id);if(!d.episode)throw new Error('Select an episode');
 const pageUrl=dramaEpisodeUrl(id),h=await html(new URL(pageUrl).pathname),p=readDramaPlayer(h,d.slug,d.episode);
 const tracks=descriptorSubtitles(p?.sourceFirst,d.language);
 let bookId:string;try{bookId=currentPlayerBookId(p)||parseDramaBookId(h,d.slug);}catch{return {tracks,complete:false};}
 // Only the same series and serial may contribute a subtitle. Failed checks are not proof of absence.
 const locales=[...new Set([d.language,'en','ar','fr','es','de','pt','id','ja','ko','th','vi','it','ru','tl','hi','ms'])];
 let next=0,checked=0,failed=unresolvedSubtitle(p?.sourceFirst)?1:0;const deadline=Date.now()+24000;
 await Promise.all(Array.from({length:4},async()=>{while(next<locales.length&&Date.now()<deadline){
  const lang=locales[next++];try{
   const descriptor=await episodeApi(bookId,dramaSourceSerial(p,d.episode!),lang,pageUrl,6000);checked++;if(unresolvedSubtitle(descriptor))failed++;
   for(const sub of descriptorSubtitles(descriptor,lang))if(!tracks.some(t=>t.lang===sub.lang&&t.url===sub.url))tracks.push(sub);
  }catch{failed++;}
 }}));
 const unique=[...new Map(tracks.map(t=>[t.lang.toLowerCase(),t])).values()],complete=checked===locales.length&&failed===0;
 if(subtitleCache.size>=100)subtitleCache.delete(subtitleCache.keys().next().value!);
 // A timeout/network error must remain retryable instead of caching a false "no subtitles" result.
 if(complete)subtitleCache.set(id,{expires:Date.now()+120000,tracks:unique,complete});
 return {tracks:unique,complete};
}
export async function dramaEpisodeSubtitles(id:string){return (await discoverDramaEpisodeSubtitles(id)).tracks;}
export async function resolveDramaEpisode(id:string){return (await resolveDramaEpisodeSource(id)).url;}
