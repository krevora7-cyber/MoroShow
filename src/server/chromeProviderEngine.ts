/**
 * NetShow v4.1 — first-party Node.js provider execution contract for Chrome.
 * This file runs provider code within the NetShow backend; it DOES NOT interpret
 * Android CloudStream .cs3/Kotlin plugins or manufacture catalog entries.
 * A provider must be independently ported, reviewed and authorized before being
 * enabled in the local registry. Keep provider API secrets server-side.
 */
import { createHash } from 'node:crypto';
import type { PlaylistItem } from '../utils/m3uParser.ts';
import { detectStreamType } from '../utils/m3uParser.ts';
import { consolidationKey } from '../utils/groupCatalog.ts';
import { fnv1a64 } from '../utils/fnv1a64.ts';

export type ProviderId = 'cnc-verse'|'streamplay'|'yacintv'|'cricify';
export type ProviderKind = 'movie'|'series'|'live';
export type ProviderSection = 'movies'|'series'|'live'|'events';
export interface ProviderEntry {
  externalId: string;
  name: string;
  kind: ProviderKind;
  section: ProviderSection;
  poster?: string;
  backdrop?: string;
  overview?: string;
  genre?: string;
  certifiedKids?: boolean;
}
export interface ProviderEpisode extends ProviderEntry {
  season: number;
  episode: number;
  seriesName: string;
}
export interface ProviderStream { url: string; label?: string; }
export interface ProviderAdapter {
  id: ProviderId;
  list(): Promise<ProviderEntry[]>;
  episodes?(externalSeriesId:string):Promise<ProviderEpisode[]>;
  streams(externalId:string):Promise<ProviderStream[]>;
}
export interface ProviderStatus {source:ProviderId;state:'working'|'not_ported'|'failed';count:number;error?:string;}
interface SourceRef {provider:ProviderAdapter; externalId:string; kind:ProviderKind; seriesName?:string;}
export interface BrowserMedia {item:PlaylistItem;overview?:string;backdrop?:string;}
const names:ProviderId[]=['cnc-verse','streamplay','yacintv','cricify'];
async function withTimeout<T>(promise:Promise<T>,ms:number):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try {return await Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error(`Provider timed out after ${ms}ms`)),ms);})]);}
 finally {if(timer)clearTimeout(timer);}
}
const permitted:Record<ProviderId,ProviderSection[]>={
 'cnc-verse':['movies','series'],'streamplay':['movies','series'],
 yacintv:['live'],cricify:['events']
};
let refs=new Map<string,SourceRef[]>();
let lastStatus:ProviderStatus[]=names.map(source=>({source,state:'not_ported',count:0}));
export const getBrowserStatus=()=>lastStatus.map(x=>({...x}));
export function hasBrowserRef(id:string){return refs.has(id);}
function safeUrl(value:unknown):string|undefined {
 if(typeof value!=='string')return;
 try {const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return;return u.toString();} catch{return;}
}
function limitedText(value:unknown,max:number):string {
 return typeof value==='string'?value.trim().replace(/[\u0000-\u001f]/g,' ').slice(0,max):'';
}
export function browserItem(e:ProviderEntry,source:ProviderId):BrowserMedia|null {
 if(!e||!permitted[source]?.includes(e.section))return null;
 const name=limitedText(e.name,180), ext=limitedText(e.externalId,300);
 if(!name||!ext||!['movie','series','live'].includes(e.kind))return null;
 if(e.section==='movies'&&e.kind!=='movie'||e.section==='series'&&e.kind!=='series'||(e.section==='live'||e.section==='events')&&e.kind!=='live')return null;
 const item:PlaylistItem={
   id:'local-'+createHash('sha256').update(`${source}:${ext}`).digest('hex').slice(0,24),
   name,kind:e.kind,streamUrl:'https://netshow.invalid/native/'+encodeURIComponent(ext),
   streamType:'hls', category:e.section==='events'?'Sports Events':limitedText(e.genre,70)||source,
   logoUrl:safeUrl(e.poster),isKidFriendly:e.certifiedKids===true,
   seriesTitle:e.kind==='series'?name:undefined,description:limitedText(e.overview,1400)
 };
 return {item,overview:item.description,backdrop:safeUrl(e.backdrop)};
}
function groupedId(item:PlaylistItem):string {return `ns-g-${fnv1a64(consolidationKey(item))}`;}
function addRef(item:PlaylistItem,provider:ProviderAdapter,externalId:string, seriesName?:string) {
 const key=groupedId(item), old=refs.get(key)||[];
 if(!old.some(r=>r.provider.id===provider.id&&r.externalId===externalId))old.push({provider,externalId,kind:item.kind,seriesName});
 refs.set(key,old);
}
/** Fetch from independent, audited JS adapters. Never loads Kotlin/.cs3 executables. */
export async function loadBrowserProviders(providers:ProviderAdapter[]):Promise<{items:BrowserMedia[];status:ProviderStatus[]}>{
 const outputs:BrowserMedia[]=[];const current=new Map<string,SourceRef[]>();
 const diagnostics=new Map<ProviderId,ProviderStatus>();
 const valid=providers.filter(p=>names.includes(p?.id)&&typeof p.list==='function'&&typeof p.streams==='function');
 // Concurrent providers, individual failure isolation. No fictional success.
 await Promise.all(valid.map(async provider=>{
   try{
    const list=await withTimeout(provider.list(),15000);
    if(!Array.isArray(list))throw Error('Provider returned non-array catalog');
    let count=0;
    for(const row of list.slice(0,10000)){
      const result=browserItem(row,provider.id);if(!result)continue;
      outputs.push(result);const key=groupedId(result.item),r=current.get(key)||[];
      r.push({provider,externalId:row.externalId,kind:row.kind,seriesName:row.kind==='series'?row.name:undefined});
      current.set(key,r);count++;
    }
    diagnostics.set(provider.id,{source:provider.id,state:'working',count});
   }catch(err){diagnostics.set(provider.id,{source:provider.id,state:'failed',count:0,error:String((err as Error).message).slice(0,200)});}
 }));
 refs=current;
 lastStatus=names.map(source=>diagnostics.get(source)||{source,state:'not_ported',count:0});
 return {items:outputs,status:getBrowserStatus()};
}
export async function browserEpisodes(id:string):Promise<BrowserMedia[]> {
 const sources=refs.get(id)||[], result:BrowserMedia[]=[];
 for(const ref of sources.filter(r=>r.kind==='series'&&typeof r.provider.episodes==='function')){
   try{
     const list=await ref.provider.episodes!(ref.externalId);
     for(const ep of (Array.isArray(list)?list:[]).slice(0,1000)){
       if(!Number.isSafeInteger(ep.season)||!Number.isSafeInteger(ep.episode)||ep.season<0||ep.episode<1)continue;
       const parsed=browserItem({...ep,kind:'series',section:'series'},ref.provider.id);
       if(!parsed)continue;
       parsed.item.season=ep.season;parsed.item.episode=ep.episode;
       parsed.item.seriesTitle=ref.seriesName||ep.seriesName;
       const key=groupedId(parsed.item),entry={provider:ref.provider,externalId:ep.externalId,kind:'series' as const,seriesName:parsed.item.seriesTitle};
       const old=refs.get(key)||[];old.push(entry);refs.set(key,old);result.push(parsed);
     }
   }catch {/* One broken episode listing must not kill others. */}
 }
 return result;
}
export async function browserPlayback(id:string):Promise<{url:string;kind:'hls'|'mp4'|'mpegts';source:ProviderId}>{
 const sources=refs.get(id)||[];
 if(!sources.length)throw Error('No native browser provider registered for this content');
 const problems:string[]=[];
 for(const ref of sources){
   try{
     const list=await ref.provider.streams(ref.externalId);
     for(const stream of Array.isArray(list)?list:[]){
       const url=safeUrl(stream.url);if(!url)continue;
       return {url,kind:detectStreamType(url),source:ref.provider.id};
     }
     problems.push(`${ref.provider.id}: no playable HTTPS/HTTP URL`);
   } catch(e) {problems.push(`${ref.provider.id}: ${String((e as Error).message).slice(0,80)}`);}
 }
 throw new Error(problems.join(' | ')||'No stream returned');
}
