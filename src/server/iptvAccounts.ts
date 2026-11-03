import {createHash} from 'node:crypto';
import {safeUrl,lease} from './geilTv';
import {xtreamGet,type XtreamConfig} from './xtream';
import type {PublicChannel} from './publicTvCatalog';
import type {CatalogItem} from '../types';
export type Account={id:string;config:XtreamConfig};
export const key=(s:string)=>createHash('sha256').update(s).digest('hex').slice(0,24);
export function readAccounts(raw=process.env.MORO_IPTV_ACCOUNTS||'[]'):Account[]{
 const values=JSON.parse(raw);if(!Array.isArray(values)||values.length>30)throw Error('Invalid IPTV account configuration');
 return values.map(v=>{const base=safeUrl(String(v.base||'')).href.replace(/\/$/,'');if(!v.username||!v.password)throw Error('Missing IPTV credentials');const api=new URL(base+'/player_api.php');api.searchParams.set('username',String(v.username));api.searchParams.set('password',String(v.password));return {id:'xtream-'+key(base+'|'+v.username),config:{api,base,username:String(v.username),password:String(v.password)}};});
}
export const iptvEnabled=()=>{try{return readAccounts().length>0;}catch{return false;}};
export type Origin={account:string;streamId:string;ext:string;series?:string};
export type Vod=CatalogItem&{origins:Origin[]};
const snapshots=new Map<string,{live:PublicChannel[];vod:Vod[]}>();let updated=0,pending:Promise<void>|undefined,revision=0;
let mergedVersion=-1,mergedVod:Vod[]=[];
const names=(s:string)=>s.normalize('NFKC').replace(/\b(?:FHD|UHD|HD|SD|4K|H265|HEVC)\b/ig,'').replace(/\s+/g,' ').trim();
const adult=(s:string)=>/\b(?:xxx|adult|porn)\b|18\+/i.test(s);
export function streamAddress(a:Account,family:string,id:string,ext:string){if(!/^(live|movie|series)$/.test(family)||!/^\d+$/.test(id)||!/^(m3u8|mp4|mkv|ts|webm)$/.test(ext))throw Error('Unsupported IPTV media');return `${a.config.base}/${family}/${encodeURIComponent(a.config.username)}/${encodeURIComponent(a.config.password)}/${id}.${ext}`;}
export async function accountAvailable(id:string){const a=readAccounts().find(a=>a.id===id);if(!a)return false;try{const d=await xtreamGet(a.config,'',{},fetch,5000),u=d.user_info;return Number(u?.auth)===1&&u.status==='Active'&&(Number(u.max_connections)===0||Number(u.active_cons)<Number(u.max_connections));}catch{return false;}}
const safeImage=(s:any)=>{if(typeof s!=='string'||!s)return undefined;try{return safeUrl(s).href;}catch{return undefined;}};
const categoryMap=(rows:any)=>new Map<string,string>((Array.isArray(rows)?rows:[]).map((r:any)=>[String(r.category_id),String(r.category_name||'Other')]));
export function mergeVod(items:Vod[]){const out=new Map<string,Vod>();for(const v of items){const k=[v.kind,names(v.name).toLowerCase(),v.year||'',v.category.toLowerCase()].join('|'),old=out.get(k);if(old){for(const o of v.origins)if(!old.origins.some(x=>x.account===o.account&&x.streamId===o.streamId))old.origins.push(o);}else out.set(k,{...v,id:'iptv:'+key(k),origins:[...v.origins]});}return [...out.values()];}
export async function refreshAccounts(){if(!iptvEnabled())return;if(pending)return pending;if(updated&&Date.now()-updated<1800000)return;pending=(async()=>{
 const accounts=readAccounts();const hosts=[...new Set(accounts.map(a=>a.config.base))];
 // One catalogue per host. A rejected account falls through to the next account on that host.
 for(const host of hosts){for(const a of accounts.filter(a=>a.config.base===host)){try{
 const result=await Promise.all(['get_live_categories','get_vod_categories','get_series_categories','get_live_streams','get_vod_streams','get_series'].map(action=>xtreamGet(a.config,action,{},fetch,18000).catch(()=>[])));
 const [lc,vc,sc]=result.slice(0,3).map(categoryMap);const live:PublicChannel[]=[],vod:Vod[]=[];const aliases=accounts.filter(b=>b.config.base===host);
 for(const r of Array.isArray(result[3])?result[3]:[]){const name=names(String(r.name||'')),category=lc.get(String(r.category_id))||'Live TV',id=String(r.stream_id);if(!name||adult(name+' '+category)||!/^\d+$/.test(id))continue;live.push({id:'',tvgId:String(r.epg_channel_id||''),name,category,country:'',language:'',logoUrl:safeImage(r.stream_icon),sources:aliases.map(b=>{const url=streamAddress(b,'live',id,'m3u8');return {id:key(url),url,provider:b.id};})});}
 for(const [offset,kind,categories]of [[4,'movie',vc],[5,'series',sc]]as const){for(const r of Array.isArray(result[offset])?result[offset]:[]){const name=names(String(r.name||'')),category=categories.get(String(r.category_id))||kind,id=String(kind==='movie'?r.stream_id:r.series_id);if(!name||adult(name+' '+category)||!/^\d+$/.test(id))continue;const year=Number(String(r.year||r.releaseDate||r.release_date||'').slice(0,4))||undefined,ext=/^(mp4|mkv|webm|m3u8)$/.test(r.container_extension)?r.container_extension:'mp4';vod.push({id:'',name,kind,category,streamUrl:'',streamType:'mp4',logoUrl:safeImage(r.stream_icon||r.cover||r.movie_image),backdropUrl:safeImage(Array.isArray(r.backdrop_path)?r.backdrop_path[0]:undefined),year,overview:String(r.plot||''),isKidFriendly:false,seriesTitle:kind==='series'?name:undefined,origins:aliases.map(b=>({account:b.id,streamId:id,ext}))});}}
 if(live.length||vod.length){snapshots.set(host,{live,vod});revision++;break;}
 }catch{/* Preserve last successful snapshot; never log credential-bearing errors. */}}}updated=Date.now();})().finally(()=>{pending=undefined;});return pending;}
async function ready(){const work=refreshAccounts();if(snapshots.size)return;await Promise.race([work,new Promise<void>(resolve=>{const until=Date.now()+20000;const poll=()=>{if(snapshots.size||Date.now()>until)resolve();else setTimeout(poll,100);};poll();})]);}
export async function iptvLive(){await ready();return [...snapshots.values()].flatMap(s=>s.live);}
export const iptvRevision=()=>revision;
export async function vodCatalog(){await ready();if(mergedVersion!==revision){mergedVod=mergeVod([...snapshots.values()].flatMap(s=>s.vod));mergedVersion=revision;}return mergedVod;}
export const publicVod=(v:Vod):CatalogItem=>{const {origins,...item}=v;const image=(u?:string)=>u?(process.env.RENDER_EXTERNAL_URL||'')+lease(u):undefined;return {...item,logoUrl:image(item.logoUrl),backdropUrl:image(item.backdropUrl)};};
const episodeIndex=new Map<string,Vod>(),episodeCache=new Map<string,{at:number;items:Vod[]}>();
export async function findVod(id:string){return episodeIndex.get(id)||(await vodCatalog()).find(v=>v.id===id);}
export async function episodesFor(root:Vod){const cached=episodeCache.get(root.id);if(cached&&Date.now()-cached.at<1800000)return cached.items;const collected:Vod[]=[],accounts=readAccounts(),seen=new Set<string>();
 for(const o of root.origins){const a=accounts.find(a=>a.id===o.account);if(!a)continue;const group=a.config.base+'|'+o.streamId;if(seen.has(group))continue;try{const d=await xtreamGet(a.config,'get_series_info',{series_id:o.streamId},fetch,12000);if(!d.episodes)continue;seen.add(group);for(const [season,rows]of Object.entries(d.episodes)){if(!Array.isArray(rows))continue;for(const ep of rows){const n=Number(ep.episode_num);if(!/^\d+$/.test(String(ep.id))||!Number.isSafeInteger(n)||n<1)continue;const ext=/^(mp4|mkv|webm|m3u8)$/.test(ep.container_extension)?ep.container_extension:'mp4';collected.push({...root,id:`${root.id}:${Number(season)||1}:${n}`,name:String(ep.title||`${root.name} · Episode ${n}`),season:Number(season)||1,episode:n,origins:root.origins.filter(x=>x.streamId===o.streamId&&accounts.find(a=>a.id===x.account)?.config.base===a.config.base).map(x=>({account:x.account,streamId:String(ep.id),ext,series:o.streamId}))});}}}catch{}}
 const merged=new Map<string,Vod>();for(const ep of collected){const old=merged.get(ep.id);if(old)old.origins.push(...ep.origins);else merged.set(ep.id,ep);}for(const [id,ep]of merged){if(episodeIndex.size>=10000)episodeIndex.delete(episodeIndex.keys().next().value!);episodeIndex.set(id,ep);}const items=[...merged.values()].sort((a,b)=>a.season!-b.season!||a.episode!-b.episode!);if(items.length){if(episodeCache.size>=100)episodeCache.delete(episodeCache.keys().next().value!);episodeCache.set(root.id,{at:Date.now(),items});}return items;}
export function sourceChoices(v:Vod){return v.origins.map((o,i)=>({id:key(o.account+'|'+o.streamId),label:'Source '+(i+1)}));}
export async function vodStream(v:Vod,sourceId:string){const sources=sourceChoices(v);let i=sources.findIndex(s=>s.id===sourceId);if(i<0&&sourceId!=='auto')throw Error('Unknown source');if(i<0)i=0;for(const n of [i,...v.origins.map((_,n)=>n).filter(n=>n!==i)]){const o=v.origins[n],a=readAccounts().find(a=>a.id===o.account);if(!a||!await accountAvailable(a.id))continue;return {streamUrl:lease(streamAddress(a,v.episode?'series':'movie',o.streamId,o.ext)),streamType:o.ext==='m3u8'?'hls':'mp4',variantId:sources[n].id,variants:sources};}throw Error('Sources busy or unavailable');}
if(iptvEnabled())setTimeout(()=>void refreshAccounts(),1000).unref();
