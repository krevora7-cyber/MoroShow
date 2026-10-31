import fs from 'node:fs';
import path from 'node:path';
/** Stremio-compatible content API adapter; does NOT execute CloudStream .cs3 files. */
import type { PlaylistItem } from '../utils/m3uParser.ts';
import { detectStreamType } from '../utils/m3uParser.ts';
import { fnv1a64 } from '../utils/fnv1a64.ts';
import { consolidationKey } from '../utils/groupCatalog.ts';

export type SourceKey = 'cnc-verse'|'streamplay'|'yacintv'|'cricify'|'bridge';
export type Kind = 'movie'|'series'|'live';
export interface Reference { source:SourceKey;base:string;type:string;videoId:string;name:string;kind:Kind; catalogId?:string; }
export interface GatewayItem { item:PlaylistItem;ref:Reference;backdrop?:string;overview?:string; }
export interface SourceStatus {source:SourceKey;status:'connected'|'not_configured'|'error';items:number;catalogs:number;error?:string;}
const SPECS: {source:SourceKey;env:string;kinds:Kind[]}[] = [
 {source:'cnc-verse',env:'NETSHOW_ADDON_CNC_VERSE_URL',kinds:['movie','series']},
 {source:'streamplay',env:'NETSHOW_ADDON_STREAMPLAY_URL',kinds:['movie','series']},
 {source:'yacintv',env:'NETSHOW_ADDON_YACINTV_URL',kinds:['live']},
 {source:'cricify',env:'NETSHOW_ADDON_CRICIFY_URL',kinds:['live']},
 {source:'bridge',env:'NETSHOW_ADDON_BRIDGE_URL',kinds:['movie','series','live']},
];
const refs=new Map<string,Reference[]>();
export interface ProviderHealth {id:string;name:string;state:string;imported:number;failed:number;streamSuccess:number;streamFailure:number;enabled:boolean;}
const providerHealth=new Map<string,ProviderHealth>();
const disabledFile=path.resolve('data/disabled-providers.json');
let disabled=new Set<string>();
try{disabled=new Set(JSON.parse(fs.readFileSync(disabledFile,'utf8')));}catch{}
export const getProviderHealth=()=>{
 let audit:any[]=[];try{audit=JSON.parse(fs.readFileSync(path.resolve('verification/provider-audit.json'),'utf8')).catalogs||[];}catch{}
 return [...providerHealth.values()].map(x=>({...x,enabled:!disabled.has(x.id),sampleCheck:audit.find(a=>a.id===x.id.split(':').slice(1).join(':'))?.result||'not sampled'}));
};
export function setProviderEnabled(id:string,enabled:boolean){
 if(!providerHealth.has(id))throw Error('Unknown provider');
 if(enabled)disabled.delete(id);else disabled.add(id);
 fs.mkdirSync(path.dirname(disabledFile),{recursive:true});fs.writeFileSync(disabledFile,JSON.stringify([...disabled]));
}
export const isGatewayVisible=(id:string)=>!refs.has(id)||refs.get(id)!.some(r=>!r.catalogId||!disabled.has(r.catalogId));

let status:SourceStatus[]=[];
export const gatewayStatus=()=>status.map(s=>({...s}));
export const getGatewayRefs=(id:string)=>(refs.get(id)||[]).filter(r=>!r.catalogId||!disabled.has(r.catalogId));
export const hasGatewayRef=(id:string)=>refs.has(id);
export function baseURL(raw:string):string{
 const u=new URL(raw);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.search||u.hash)throw Error('Invalid addon address');
 return u.origin+u.pathname.replace(/\/manifest\.json\/?$/,'').replace(/\/$/,'');
}
export function allowedAddonOrigin(url:string,env:NodeJS.ProcessEnv=process.env):boolean{
 try {const u=new URL(url);return SPECS.some(s=>env[s.env]&&new URL(baseURL(env[s.env]!)).origin===u.origin);}catch{return false;}
}
export async function getJSON(url:string,fetcher:typeof fetch=fetch,limit=3_000_000):Promise<any>{
 const r=await fetcher(url,{redirect:'error',headers:{Accept:'application/json'},signal:AbortSignal.timeout(45000)});
 if(!r.ok)throw Error(`HTTP ${r.status}`);
 if(Number(r.headers.get('content-length')||0)>limit)throw Error('Response too large');
 const body=await r.text();if(body.length>limit)throw Error('Response too large');return JSON.parse(body);
}
function kindFor(type:string):Kind|null{
 if(['movie','film'].includes(type))return 'movie';
 if(['series','tvseries'].includes(type))return 'series';
 if(['tv','channel','live','livetv'].includes(type))return 'live';return null;
}
// CNC publishes mixed shelves as `other`, including blank poster-only titles.
// Resolve their actual metadata before classifying; never put every shelf in Movies.
const detailCache=new Map<string,{at:number;meta:any}>();
async function metadata(base:string,type:string,id:string,fetcher:typeof fetch){
 const key=`${base}/meta/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`;
 const hit=detailCache.get(key);if(fetcher===fetch&&hit&&Date.now()-hit.at<1800000)return hit.meta;
 const doc=await getJSON(key,fetcher);if(!doc?.meta)throw Error('Missing title metadata');
 if(fetcher===fetch){if(detailCache.size>5000)detailCache.clear();detailCache.set(key,{at:Date.now(),meta:doc.meta});}
 return doc.meta;
}
export function classifyMetadata(meta:any):Kind|null{
 const explicit=kindFor(meta?.type);if(explicit)return explicit;
 if(meta?.type!=='other')return null;
 if(Array.isArray(meta.videos)&&meta.videos.some((v:any)=>Number(v.episode)>0))return 'series';
 // A runtime without episode metadata is the bridge's movie representation.
 if(typeof meta.runtime==='string'&&meta.runtime.trim())return 'movie';
 return null;
}
async function limitedMap<T>(rows:T[],work:(row:T)=>Promise<void>){
 let next=0;await Promise.all(Array.from({length:Math.min(4,rows.length)},async()=>{
  while(next<rows.length){const row=rows[next++];await work(row);}
 }));
}
function mediaURL(s:unknown):string|undefined{if(typeof s!=='string')return;try{const u=new URL(s);return ['http:','https:'].includes(u.protocol)?u.href:undefined;}catch{return;}}
function toItem(base:string,source:SourceKey,kind:Kind,type:string,meta:any):GatewayItem|null{
 if(typeof meta?.name!=='string'||typeof meta?.id!=='string'||!meta.name.trim())return null;
 const name=meta.name.replace(/\u2800/g,'').trim().slice(0,160);if(!name)return null;const key=`${source}:${type}:${meta.id}`;
 const item:PlaylistItem={id:`gw-${fnv1a64(key)}`,name,kind,streamUrl:`https://netshow.invalid/gateway/${fnv1a64(key)}`,streamType:'hls',
 category:source==='cricify'?'Cricify Events':(typeof meta.genres?.[0]==='string'?meta.genres[0].slice(0,60):source),logoUrl:mediaURL(meta.poster)||mediaURL(meta.logo),
 seriesTitle:kind==='series'?name:undefined,isKidFriendly:false,description:typeof meta.description==='string'?meta.description.slice(0,800):''};
 return {item,ref:{source,base,type,videoId:meta.id,name,kind},overview:item.description,backdrop:mediaURL(meta.background)};
}
export function registerGatewayItems(items:GatewayItem[],replace=true):void{
 if(replace)refs.clear();
 for(const data of items){const id=`ns-g-${fnv1a64(consolidationKey(data.item))}`;const existing=refs.get(id)||[];
 if(!existing.some(r=>r.base===data.ref.base&&r.videoId===data.ref.videoId))existing.push(data.ref);
 refs.set(id,existing);}
}
export async function loadGateway(fetcher:typeof fetch=fetch,env:NodeJS.ProcessEnv=process.env,onProgress?:(items:GatewayItem[])=>void):Promise<{items:GatewayItem[];status:SourceStatus[]}>{
 const items:GatewayItem[]=[];const reports:SourceStatus[]=[];const attempted=new Set<string>();let lastProgress=0;let lastSave=0;
 const cacheFile=path.resolve('data/cnc-catalog-cache.json');
 const signature=SPECS.map(x=>env[x.env]||'').join('|');
 let cached:GatewayItem[]=[];
 if(fetcher===fetch&&onProgress){try{const saved=JSON.parse(fs.readFileSync(cacheFile,'utf8'));if(saved.signature===signature&&Date.now()-saved.at<86400000)cached=saved.items;}catch{}}
 const publish=(force=false)=>{if(onProgress&&(force||Date.now()-lastProgress>5000)){
   lastProgress=Date.now();
   const combined=new Map(cached.map(x=>[x.item.id,x]));for(const x of items)combined.set(x.item.id,x);
   const visible=[...combined.values()].filter(x=>!x.ref.catalogId||!disabled.has(x.ref.catalogId));
   registerGatewayItems(visible,false);onProgress(visible);
   if(fetcher===fetch&&visible.length&&(force||Date.now()-lastSave>60000)){
     lastSave=Date.now();try{fs.mkdirSync(path.dirname(cacheFile),{recursive:true});fs.writeFileSync(cacheFile+'.tmp',JSON.stringify({signature,at:Date.now(),items:visible}),{mode:0o600});fs.renameSync(cacheFile+'.tmp',cacheFile);}catch{}
   }
 }};
 if(cached.length)publish(true);
 const pending:{base:string;spec:typeof SPECS[number];cat:any;rows:any[];health:ProviderHealth}[]=[];
 const ingest=async({p,entry}:{p:typeof pending[number];entry:any})=>{
   if(disabled.has(p.health.id))return;
   try{
    if(typeof entry?.id!=='string')return;
    const meta=p.cat.type==='other'?{...entry,...await metadata(p.base,p.cat.type,entry.id,fetcher)}:entry;
    const kind=kindFor(p.cat.type)||classifyMetadata(meta);if(!kind||!p.spec.kinds.includes(kind))return;
    const item=toItem(p.base,p.spec.source,kind,p.cat.type,meta);
    if(item){item.ref.catalogId=p.health.id;items.push(item);p.health.imported++;publish();}
   }catch{p.health.failed++;}
 };
 await Promise.all(SPECS.map(async spec=>{
  if(!env[spec.env]){reports.push({source:spec.source,status:'not_configured',items:0,catalogs:0});return;}
  try{
   const base=baseURL(env[spec.env]!);const identity=base+spec.kinds.join(',');if(attempted.has(identity))return;attempted.add(identity);
   const manifest=await getJSON(base+'/manifest.json',fetcher,500000);
   const cats=(manifest.catalogs||[]).filter((cat:any)=>cat&&typeof cat.id==='string'&&typeof cat.type==='string'&&((kindFor(cat.type)&&spec.kinds.includes(kindFor(cat.type)!))||(cat.type==='other'&&spec.kinds.includes('movie'))));
   await limitedMap(cats,async(cat:any)=>{
    const key=spec.source+':'+cat.id;
    const health:ProviderHealth={id:key,name:cat.name||cat.id,state:'loading',imported:0,failed:0,streamSuccess:providerHealth.get(key)?.streamSuccess||0,streamFailure:providerHealth.get(key)?.streamFailure||0,enabled:!disabled.has(key)};
    providerHealth.set(key,health);
    if(!health.enabled){health.state='disabled';return;}
    try{
     const doc=await getJSON(`${base}/catalog/${encodeURIComponent(cat.type)}/${encodeURIComponent(cat.id)}.json`,fetcher,12000000);
     if(!Array.isArray(doc.metas))throw Error('No catalog returned');
     const group={base,spec,cat,rows:doc.metas,health};pending.push(group);health.state=doc.metas.length?'loading':'empty';
     await limitedMap(doc.metas.slice(0,Math.min(4,Number(env.NETSHOW_CATALOG_PER_SOURCE)||4)),entry=>ingest({p:group,entry}));
    }catch{health.state='unavailable';health.failed++;}
   });
   reports.push({source:spec.source,status:'connected',items:0,catalogs:cats.length});
  }catch{reports.push({source:spec.source,status:'error',items:0,catalogs:0,error:'Provider catalog unavailable'});}
 }));
 // Round-robin batches prevent one giant Netflix shelf from starving other providers.
 const limit=Number(env.NETSHOW_CATALOG_PER_SOURCE)||Number.MAX_SAFE_INTEGER;
 let offset=4;
 while(pending.some(p=>offset<Math.min(p.rows.length,limit))){
  const jobs=pending.flatMap(p=>p.rows.slice(offset,Math.min(offset+8,limit)).map(entry=>({p,entry})));
  await limitedMap(jobs,ingest);
  offset+=8;
  for(const p of pending)if(offset>=Math.min(p.rows.length,limit))p.health.state=p.health.imported?'catalog ready':p.health.failed?'unavailable':'empty';
  publish();
 }
 for(const p of pending)p.health.state=disabled.has(p.health.id)?'disabled':p.health.imported?'catalog ready':p.health.failed?'unavailable':'empty';
 for(const r of reports)r.items=items.filter(x=>x.ref.source===r.source).length;
 status=reports;registerGatewayItems(items,!onProgress);publish(true);return {items,status:reports};
}
export function providerHeaders(value:unknown):Record<string,string>{
 const result:Record<string,string>={};
 if(!value||typeof value!=='object')return result;
 for(const [key,v] of Object.entries(value)){
  if(!/^(accept|accept-language|origin|referer|user-agent|cookie|authorization|x-mb-token|x-requested-with)$/i.test(key))continue;
  if(typeof v==='string'&&v.length<16384&&!/[\r\n\0]/.test(v))result[key.toLowerCase()]=v;
 }
 return result;
}
export interface GatewayStream {
 url:string; kind:'hls'|'mp4'|'mpegts'; source:SourceKey; headers?:Record<string,string>;
 variantId?:string; variants?:{id:string;label:string}[];
 subtitles?:{url:string;lang:string;label:string}[];
}
const streamCache=new Map<string,{at:number;data:any}>();
export async function resolveGatewayStream(id:string,fetcher:typeof fetch=fetch,variantId?:string):Promise<GatewayStream>{
 const candidates=getGatewayRefs(id);if(!candidates.length)throw Error('Content source is disabled or unavailable');
 const parts=variantId?.split(':')||[];
 const selectedRef=parts[0]==='gwref'?Number(parts[1]):parts.length===3?Number(parts[1]):undefined;
 const selectedStream=parts[0]==='gwref'?0:parts[0]==='gw'?Number(parts.at(-1)):0;
 async function resolve(ref:Reference,refIndex:number):Promise<GatewayStream>{
  const endpoint=`${ref.base}/stream/${encodeURIComponent(ref.type)}/${encodeURIComponent(ref.videoId)}.json`;
  const hit=fetcher===fetch?streamCache.get(endpoint):undefined;
  let data:any;
  try{data=hit&&Date.now()-hit.at<90000?hit.data:await getJSON(endpoint,fetcher);}
  catch{if(ref.catalogId){const h=providerHealth.get(ref.catalogId);if(h)h.streamFailure++;}throw Error('Source did not respond');}
  if(fetcher===fetch){if(streamCache.size>150)streamCache.clear();streamCache.set(endpoint,{at:Date.now(),data});}
  const streams=(data?.streams||[]).filter((s:any)=>mediaURL(s.url));
  const stream=streams[selectedStream];if(!stream)throw Error('Selected server returned no video link');
  const variants=streams.map((s:any,i:number)=>({id:`gw:${refIndex}:${i}`,label:String(s.name||s.title||`Server ${i+1}`).slice(0,180)}));
  for(let i=0;i<candidates.length;i++)if(i!==refIndex)variants.push({id:`gwref:${i}`,label:`Try ${candidates[i].catalogId?.split(':').slice(1).join(':')||candidates[i].source}`});
  const subtitles=(Array.isArray(stream.subtitles)?stream.subtitles:[]).filter((s:any)=>mediaURL(s.url)).map((s:any)=>({url:mediaURL(s.url)!,lang:String(s.lang||s.language||'und').slice(0,30),label:String(s.label||s.lang||s.language||'Subtitle').slice(0,80)}));
  if(ref.catalogId){const h=providerHealth.get(ref.catalogId);if(h)h.streamSuccess++;}
  return {url:mediaURL(stream.url)!,kind:detectStreamType(stream.url),source:ref.source,headers:providerHeaders(stream.behaviorHints?.proxyHeaders?.request),variantId:`gw:${refIndex}:${selectedStream}`,variants,subtitles};
 }
 if(selectedRef!==undefined){if(!Number.isInteger(selectedRef)||!candidates[selectedRef])throw Error('Unknown source');return resolve(candidates[selectedRef],selectedRef);}
 // Race a small number of actual sources; one dead provider must not block the others.
 try{return await Promise.any(candidates.slice(0,3).map((ref,i)=>resolve(ref,i)));}
 catch{throw Error('No video link returned by the available sources. Try another title or check Sources.');}
}
export async function loadGatewayEpisodes(id:string,fetcher:typeof fetch=fetch):Promise<GatewayItem[]>{
 const ref=getGatewayRefs(id).find(r=>r.kind==='series');if(!ref)return [];
 const data={meta:await metadata(ref.base,ref.type,ref.videoId,fetcher)};
 const videos=Array.isArray(data?.meta?.videos)?data.meta.videos:[];
 const episodes:GatewayItem[]=[];
 for(const v of videos){
  if(typeof v?.id!=='string')continue;
  const season=Number(v.season)||1,episode=Number(v.episode)||0;
  if(!episode)continue;
  const name=`${ref.name} S${String(season).padStart(2,'0')}E${String(episode).padStart(2,'0')}`;
  const parsed=toItem(ref.base,ref.source,'series',ref.type,{id:v.id,name,poster:v.thumbnail||data?.meta?.poster});
  if(!parsed)continue;
  parsed.ref.catalogId=ref.catalogId;
  parsed.item.seriesTitle=ref.name;parsed.item.season=season;parsed.item.episode=episode;
  parsed.item.description=typeof v.overview==='string'?v.overview.slice(0,600):'';
  episodes.push(parsed);
 }
 return episodes;
}
