import {webTvAccount} from './webTvAccount';
import {ProgressiveRefresh} from './progressiveRefresh';
import type {Express} from 'express';
import {registerGeilTv,lease,probeStream} from './geilTv';
import {PUBLIC_LISTS,parsePublicM3u,mergePublicChannels,type PublicChannel} from './publicTvCatalog';
const snapshots=new Map<string,PublicChannel[]>(),status=new Map<string,{updatedAt?:number;error?:string}>();
let channels:PublicChannel[]=[],index=new Map<string,PublicChannel>(),updatedAt=0;
const refreshing=new ProgressiveRefresh();
function publish(){channels=mergePublicChannels([...snapshots.values()].flat());index=new Map(channels.map(c=>[c.id,c]));if(channels.length)refreshing.publish();}
async function refresh(){return refreshing.start(async()=>{await Promise.all(PUBLIC_LISTS.map(async p=>{try{const r=await fetch(p.url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);const reader=r.body?.getReader();if(!reader)throw Error('Empty response');const parts:Uint8Array[]=[];let size=0;try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>24_000_000)throw Error('Playlist too large');parts.push(value);}}finally{await reader.cancel();}const rows=parsePublicM3u(Buffer.concat(parts).toString(),p.id);if(!rows.length)throw Error('No supported channels');snapshots.set(p.id,rows);publish();status.set(p.id,{updatedAt:Date.now()});}catch(e){status.set(p.id,{...status.get(p.id),error:String(e)});}}));updatedAt=Date.now();});}
async function catalog(){if(!updatedAt&&!channels.length){void refresh();await refreshing.waitForFirst();}if(Date.now()-updatedAt>(channels.length?21600000:30000))void refresh();}
const exposed=(c:PublicChannel)=>({...c,logoUrl:c.logoUrl&&c.sources.some(s=>s.provider.startsWith('xtream-'))?(process.env.RENDER_EXTERNAL_URL||'')+lease(c.logoUrl):c.logoUrl,tvgId:undefined,sources:c.sources.map((s,i)=>({id:s.id,label:'Source '+(i+1)})),kind:'live',streamType:'hls',streamUrl:'',isKidFriendly:false});
const verified=new Map<string,number>();
export function registerPublicTv(app:Express,{accountOnly=false}={}){
 const xtream=webTvAccount(process.env.MOROSHOW_WEB_TV_ACCOUNT||'');
 async function entries(privateCatalog:boolean) {
   if(privateCatalog)return xtream.catalog();
   await catalog();
   return index;
 }
 registerGeilTv(app,true);if(!accountOnly)setTimeout(()=>void refresh(),1000).unref();
 app.get('/api/live/channels',async(req,res)=>{const privateCatalog=req.query.catalog==='xtream';let catalogChannels:PublicChannel[];
 try{catalogChannels=[...(await entries(privateCatalog)).values()];}
 catch(error){return res.status(503).json({success:false,error:(error as Error).message});}
 if(!catalogChannels.length)return res.status(503).json({success:false,error:'Channel directories are temporarily unavailable. Please retry.'});const category=String(req.query.category||'all'),q=String(req.query.search||'').trim().toLowerCase().slice(0,80),cursor=String(req.query.cursor||'0')||'0';if(!/^\d{1,8}$/.test(cursor))return res.status(400).json({success:false,error:'Invalid page'});const counts=new Map<string,number>();for(const c of catalogChannels)counts.set(c.category,(counts.get(c.category)||0)+1);const items=catalogChannels.filter(c=>(category==='all'||c.category===category)&&(!q||(c.name+' '+c.country).toLowerCase().includes(q)));const offset=Number(cursor);res.json({success:true,catalog:privateCatalog?'xtream':'public',refreshing:!privateCatalog&&refreshing.refreshing,items:items.slice(offset,offset+100).map(exposed),total:items.length,nextCursor:offset+100<items.length?offset+100:null,groups:[{id:'all',name:'All channels',count:catalogChannels.length},...[...counts].sort(([a],[b])=>a.localeCompare(b)).map(([id,count])=>({id,name:id,count}))],providers:privateCatalog?[]:PUBLIC_LISTS.map(p=>({name:p.name,website:p.website,license:p.license,...status.get(p.id)}))});});
 app.post('/api/live/play',async(req,res)=>{const privateCatalog=req.body.catalog==='xtream';let catalogIndex:Map<string,PublicChannel>;
 try{catalogIndex=await entries(privateCatalog);}
 catch(error){return res.status(503).json({success:false,error:(error as Error).message});}
 const channel=catalogIndex.get(String(req.body.contentId));if(!channel)return res.status(404).json({success:false,error:'Refresh the channel guide.'});const source=String(req.body.sourceId||'');if(source&&!channel.sources.some(s=>s.id===source))return res.status(400).json({success:false,error:'Unknown source'});const tried=new Set<string>(Array.isArray(req.body.excludeIds)?req.body.excludeIds.filter((s:any)=>typeof s==='string').slice(0,24):[]);const candidates=channel.sources.filter(s=>!tried.has(s.id)).sort((a,b)=>Number(b.id===source)-Number(a.id===source)).slice(0,3);const abort=new AbortController();res.once('close',()=>abort.abort());
 const failed=new Set<string>();
 const policy=privateCatalog?xtream.mediaPolicy():undefined;
 const probeTimeout=privateCatalog?14000:8000;
 const probe=async(feed:typeof candidates[number])=>{try{const mp4=new URL(feed.url).pathname.toLowerCase().endsWith('.mp4');if(!mp4&&(verified.get(feed.id)||0)<Date.now()){await probeStream(feed.url,AbortSignal.any([abort.signal,AbortSignal.timeout(probeTimeout)]),policy);if(verified.size>2000)verified.clear();verified.set(feed.id,Date.now()+60000);}return {feed,mp4};}catch(e){failed.add(feed.id);throw e;}};
 try{
  // Explicit choices get priority; automatic fallback races up to three feeds.
  const preferred=source?candidates.find(s=>s.id===source):undefined;
  let result:Awaited<ReturnType<typeof probe>>|undefined;
  if(preferred)try{result=await probe(preferred);}catch{abort.signal.throwIfAborted();}
  if(!result)result=await Promise.any(candidates.filter(s=>s!==preferred).map(probe));
  if(abort.signal.aborted)return;
  return res.json({success:true,streamUrl:lease(result.feed.url,policy),streamType:result.mp4?'mp4':'hls',sourceId:result.feed.id,attemptedIds:[...new Set([...tried,...failed,result.feed.id])]});
 }catch{if(abort.signal.aborted)return;for(const id of failed)tried.add(id);}

 res.status(502).json({success:false,error:'No working source was reachable. Try another source or retry later.',attemptedIds:[...tried]});
 });
}
