import type {CatalogItem} from '../types';
import {DramaboxClient} from '../../vendor/dramabox/src/core/dramabox.js';
export type ShortProvider='dramabox'|'goodshort'|'reelshort';
export const providerNames={dramabox:'DramaBox',goodshort:'GoodShort',reelshort:'ReelShort'};
let client:any;
function box(){return client??=new DramaboxClient({language:process.env.SHORTS_LANGUAGE||'en'});}
export function parseShortId(id:string){const m=/^short:(dramabox|goodshort|reelshort):([\w-]+)(?::([\w-]+))?$/.exec(id);if(!m)throw new Error('Invalid Shorts ID');return {provider:m[1] as ShortProvider,book:m[2],chapter:m[3]};}
export function normalizeShort(provider:ShortProvider,b:any):CatalogItem{
 const id=b.bookId??b.book_id??b.id,name=b.bookName||b.book_title||b.name||b.title;
 if(!id||!name||!/^\w[\w-]*$/.test(String(id)))throw new Error('Invalid title returned by '+providerNames[provider]);
 const cover=b.cover||b.coverWap||b.book_pic||b.image;
 return {id:`short:${provider}:${id}`,name,seriesTitle:name,kind:'series',category:'Shorts',streamUrl:'',streamType:'hls',logoUrl:cover,backdropUrl:cover,overview:b.introduction||b.description||'',isKidFriendly:false};
}
function unpack(d:any){if(d?.success===false||d?.error){const message=String(d.message||'Provider rejected the request');if(/HTTP 403/.test(message))throw new Error('DramaBox refused access (HTTP 403). Its API is unavailable; no playable catalog was returned.');throw new Error(message.replace(/<[^>]*>/g,'').slice(0,350));}return d?.data??d;}
async function api(p:Exclude<ShortProvider,'dramabox'>,path:string){
 const token=process.env[p==='goodshort'?'GOODSHORT_AUTH_TOKEN':'REELSHORT_AUTH_TOKEN']?.trim();
 if(!token)throw new Error(`${providerNames[p]} needs ${p.toUpperCase()}_AUTH_TOKEN in .env. Restart MoroShow after adding it.`);
 const base=process.env[p==='goodshort'?'GOODSHORT_API_URL':'REELSHORT_API_URL']||(p==='goodshort'?'https://reelapi.it.com/goodshort/api/v1':'https://captain.sapimu.au/reelshort/api/v1');
 const url=new URL(base.replace(/\/$/,'')+path);if(url.protocol!=='https:')throw new Error('Provider API must use HTTPS');
 const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json','User-Agent':'Mozilla/5.0'},redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new Error(`${providerNames[p]} returned HTTP ${r.status}`);
 const d=await r.json();unpack(d);return d;
}
export async function shortCatalog(provider:string,page:number,q:string){
 if(!Object.hasOwn(providerNames,provider))throw new Error('Unknown Shorts source');
 const p=provider as ShortProvider;let rows:any[],hasMore=false;
 if(p==='dramabox'){const d=unpack(await (q?box().searchDrama(q,page,20):box().getDramaList(page,20)));rows=d.book||[];hasMore=!!d.isMore;}
 else if(p==='goodshort'){const d=unpack(await api(p,q?`/search?q=${encodeURIComponent(q)}`:`/home?channelId=${encodeURIComponent(process.env.GOODSHORT_CHANNEL_ID||'562')}&page=${page}&pageSize=20`));rows=q?d.searchResult?.records||[]:(d.records||[]).flatMap((s:any)=>s.items||[]);hasMore=!q&&rows.length>=20;}
 else{const lang=encodeURIComponent(process.env.SHORTS_LANGUAGE||'en');const d=unpack(await api(p,q?`/search?q=${encodeURIComponent(q)}&page=${page}&lang=${lang}`:`/foryou?lang=${lang}`));rows=q?d.lists||[]:(d.lists||[]).flatMap((s:any)=>s.books||[]);hasMore=q?!!d.has_more:false;}
 if(!Array.isArray(rows))throw new Error('Unexpected provider catalog format');
 return {items:[...new Map(rows.map(b=>{const i=normalizeShort(p,b);return [i.id,i] as const;})).values()],page,hasMore};
}
export async function shortDetails(id:string){
 const {provider:p,book}=parseShortId(id);let b:any,chapters:any[];
 if(p==='dramabox'){const [d,c]=await Promise.all([box().getDramaDetail(book),box().getChapters(book)]);b=unpack(d).detail;chapters=unpack(c).chapters||[];}
 else{const lang=encodeURIComponent(process.env.SHORTS_LANGUAGE||'en');const [d,c]=await Promise.all([api(p,`/book/${book}?lang=${lang}`),api(p,p==='goodshort'?`/chapters/${book}`:`/book/${book}/chapters?lang=${lang}`)]);b=p==='goodshort'?unpack(d).book:unpack(d);chapters=p==='goodshort'?unpack(c).list||[]:unpack(c).chapters||[];}
 const item=normalizeShort(p,b);const episodes=chapters.map((c:any,i:number)=>({...item,id:`short:${p}:${book}:${c.chapterId??c.chapter_id??c.id}`,name:c.chapterName||c.chapter_name||c.name||`Episode ${i+1}`,season:1,episode:i+1}));
 return {item,episodes,chapters};
}
export async function shortStream(id:string){
 const {provider:p,book,chapter}=parseShortId(id);if(!chapter)throw new Error('Select an episode');
 const details=await shortDetails(id),index=details.episodes.findIndex(e=>e.id===id);if(index<0)throw new Error('Episode unavailable');
 const c=details.chapters[index];let url:string,kind:'hls'|'mp4'='hls',key:Buffer|undefined;
 if(p==='dramabox'){if(c.isLocked||c.isCharge)throw new Error('This episode is locked by the provider');url=c.videoPath;kind='mp4';}
 else if(p==='reelshort'){if(c.is_lock)throw new Error('This episode is locked by the provider');const d=unpack(await api(p,`/book/${book}/chapter/${chapter}/video`));const vs=d.videos||[];url=(vs.find((v:any)=>v.Encode==='H264')||vs[0])?.PlayURL;}
 else{const raw=await api(p,`/play/${book}/${chapter}`),d=unpack(raw);url=d.m3u8;if(d.k&&d.s){const bytes=Buffer.from(d.k,'base64');let hex='';if(bytes.length<32||typeof d.s!=='string'||!d.s.length)throw new Error('Invalid provider playback key');for(let i=0;i<32;i++)hex+=String.fromCharCode(bytes[i]^d.s.charCodeAt(i%d.s.length));if(!/^[a-fA-F0-9]{32}$/.test(hex))throw new Error('Invalid provider playback key');key=Buffer.from(hex,'hex');}}
 if(!url)throw new Error('Provider returned no playable video for this episode');
 if(new URL(url).pathname.endsWith('.mp4'))kind='mp4';
 return {url,kind,key,content:details.episodes[index],provider:p};
}
