import React,{useEffect,useState} from 'react';
import {apiFetch} from '../player/netshowApi';
import {useCatalog} from '../context/CatalogContext';
type Source={id:string;name:string;state:string;imported:number;failed:number;streamSuccess:number;streamFailure:number;enabled:boolean;sampleCheck?:string};
export default function ProviderStatusPanel(){
 const [sources,setSources]=useState<Source[]>([]);const [tv,setTv]=useState<any>({});const [error,setError]=useState('');const {refreshCatalog}=useCatalog();
 const load=async()=>{try{const r=await apiFetch('/api/providers');const d=await r.json();setSources(d.providers||[]);setTv(d.tv||{});}catch{setError('Source status unavailable');}};
 useEffect(()=>{void load();const timer=setInterval(load,15000);return()=>clearInterval(timer);},[]);
 const toggle=async(s:Source)=>{try{const r=await apiFetch('/api/providers/toggle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:s.id,enabled:!s.enabled})});if(!r.ok)throw Error();await load();await refreshCatalog();}catch{setError('Could not update this source');}};
 return <section className="space-y-4"><div><h3 className="font-bold text-lg">Sources · MoroShow 4.4</h3><p className="text-sm text-neutral-400">Movies and series from CNC. TV from your Xtream account.</p></div>
 <div className="rounded-xl border border-white/15 p-4">TV: {tv.state||'checking'} · {tv.channels||0} channels {tv.error&&<p className="text-sm text-amber-300">{tv.error}</p>}</div>
 <p className="text-xs text-neutral-400">Catalog ready means titles were imported. Links found means an extractor returned video links; it does not certify playback. Turn off sources you do not want. Re-enabled empty sources load after restarting the server.</p>
 {error&&<p role="alert">{error}</p>}
 <div className="space-y-2 max-h-[55vh] overflow-y-auto">{sources.map(s=><div key={s.id} className="flex items-center justify-between gap-3 rounded-lg bg-neutral-900 p-3"><div className="min-w-0"><p className="font-medium text-sm">{s.name}</p><p className="text-xs text-neutral-400">{s.state} · {s.imported} titles · {s.failed} import errors · {s.streamSuccess} links found</p><p className="text-xs text-neutral-500">Sample: {s.sampleCheck || 'not tested'}</p></div><button aria-pressed={s.enabled} onClick={()=>toggle(s)} className={`shrink-0 rounded px-3 py-2 text-sm ${s.enabled?'bg-white text-black':'bg-neutral-700 text-white'}`}>{s.enabled?'On':'Off'}</button></div>)}</div>
 </section>;
}
