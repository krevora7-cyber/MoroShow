import {useCallback,useEffect,useState} from 'react';
import {CalendarClock,ChevronLeft,ExternalLink,RefreshCw,Trophy} from 'lucide-react';
import {decodeMatchFeed} from '../events/decodeMatchFeed';

type Team={name?:string;name_ar?:string;logo?:string;score?:number|null};
type Match={id:number;date?:string;time?:string;status?:number;active?:number;has_channels?:number;home?:Team;away?:Team;league?:{name?:string;name_ar?:string};live_domain?:string};
type MatchFeed={matches?:Match[];live_domain?:string};
const API='https://cdn.kora-api.org/api/v1/matches';
const asset=(p?:string)=>p&&/^uploads\/[a-zA-Z0-9_./-]+$/.test(p)?`https://cdn.kora-api.org/${p}`:undefined;
const name=(t?:Team)=>t?.name_ar||t?.name||'—';
const status=(m:Match)=>Number(m.status)===1||Number(m.status)===3?'LIVE':Number(m.status)===2?'Finished':'Upcoming';
const rank=(m:Match)=>status(m)==='LIVE'?0:status(m)==='Upcoming'?1:2;
function watchUrl(m:Match,domain?:string){
 if(Number(m.active)!==1||Number(m.has_channels)!==1||!Number.isSafeInteger(Number(m.id)))return '';
 const host=(m.live_domain||domain||'').toLowerCase().replace(/^https?:\/\//,'').split('/')[0];
 // The specified source uses robotiva.online. Do not embed arbitrary hosts from the feed.
 if(host!=='robotiva.online')return '';
 return `https://robotiva.online/kora.html?m=${encodeURIComponent(m.id)}&ref=yacinews.com`;
}
export default function EventsPage(){
 const [matches,setMatches]=useState<Match[]>([]),[domain,setDomain]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[selected,setSelected]=useState<Match|null>(null);
 const load=useCallback(async(signal?:AbortSignal)=>{
  try{
   const response=await fetch(API,{signal,headers:{Accept:'application/json'}});
   if(!response.ok)throw new Error('Events source is unavailable.');
   const feed:MatchFeed|Match[]=await decodeMatchFeed(await response.text());
   if(signal?.aborted)return;
   const list=Array.isArray(feed)?feed:feed.matches;
   if(!Array.isArray(list))throw new Error('Events source returned an unexpected format.');
   setMatches(list.slice().sort((a,b)=>rank(a)-rank(b)));setDomain(Array.isArray(feed)?'':feed.live_domain||'');setError('');
  }catch(e:any){if(!signal?.aborted)setError(e?.message||'Unable to load events.');}
  finally{if(!signal?.aborted)setLoading(false);}
 },[]);
 useEffect(()=>{const controller=new AbortController();void load(controller.signal);const timer=setInterval(()=>{if(!document.hidden)void load(controller.signal)},60000);return()=>{controller.abort();clearInterval(timer);};},[load]);
 const url=selected?watchUrl(selected,domain):'';
 return <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-6 text-white" aria-label="Events">
  <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-4"><div className="rounded-2xl bg-red-600/15 p-3 text-red-500"><Trophy size={28}/></div><div><p className="text-xs text-red-500 font-bold uppercase tracking-widest">MoroShow Sport</p><h1 className="text-3xl sm:text-4xl font-extrabold">Events</h1><p className="text-zinc-400 text-sm mt-2">Match listings from Yacinews</p></div></div><button className="rounded-xl border border-zinc-700 px-4 py-2 flex items-center gap-2" onClick={()=>{setLoading(true);void load();}}><RefreshCw size={16}/>Refresh</button></div>
  {selected&&url&&<section className="space-y-3" aria-label="Selected event"><div className="flex flex-wrap items-center justify-between gap-3"><button className="flex items-center gap-2" onClick={()=>setSelected(null)}><ChevronLeft size={18}/>All events</button><a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-zinc-300">Open source <ExternalLink size={14}/></a></div><h2 className="text-xl font-bold">{name(selected.home)} — {name(selected.away)}</h2><div className="w-full aspect-video bg-black rounded-2xl overflow-hidden"><iframe key={url} src={url} title={`${name(selected.home)} vs ${name(selected.away)}`} className="w-full h-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation" referrerPolicy="strict-origin-when-cross-origin"/></div><p className="text-xs text-zinc-400">Playback is provided by a third-party site and may be unavailable.</p></section>}
  {error&&<div className="rounded-xl border border-red-800 bg-red-950/40 p-4" role="alert">{error}</div>}
  {loading&&!matches.length?<p role="status" className="text-zinc-400">Loading events…</p>:!matches.length&&!error?<div className="rounded-2xl border border-zinc-800 p-10 text-center text-zinc-400"><CalendarClock className="mx-auto mb-3"/>No events available right now.</div>:<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{matches.map(m=>{const link=watchUrl(m,domain),live=status(m);return <button key={m.id} disabled={!link} onClick={()=>{setSelected(m);window.scrollTo({top:0,behavior:'smooth'});}} className="text-left rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 space-y-4 disabled:opacity-60 enabled:hover:border-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"><div className="flex items-center justify-between gap-2 text-xs text-zinc-400"><span>{m.league?.name_ar||m.league?.name||'Sport'}</span><span className={live==='LIVE'?'text-red-400 font-bold':'text-zinc-400'}>{live}</span></div><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 min-w-0">{asset(m.home?.logo)&&<img src={asset(m.home?.logo)} alt="" className="w-9 h-9 object-contain" loading="lazy"/>}<strong>{name(m.home)}</strong></div><span className="font-bold whitespace-nowrap">{m.home?.score!=null&&m.away?.score!=null?`${m.home.score} – ${m.away.score}`:(m.time||'vs')}</span><div className="flex items-center gap-2 min-w-0 text-right"><strong>{name(m.away)}</strong>{asset(m.away?.logo)&&<img src={asset(m.away?.logo)} alt="" className="w-9 h-9 object-contain" loading="lazy"/>}</div></div><p className="text-xs text-zinc-400">{m.date||''} {link?' · Watch event':' · No stream available'}</p></button>})}</div>}
 </section>;
}
