import React, {useState} from 'react';
import {apiFetch} from '../player/netshowApi';
import { Trophy, CalendarClock, AlertTriangle } from 'lucide-react';
import { useCatalog } from '../context/CatalogContext';
import { MediaTile } from './MediaTile';
/** Only display events actually returned by the configured Cricify-compatible catalog. */
export default function EventsPage() {
  const { items, isLoading, catalogError } = useCatalog();
  const [refreshing,setRefreshing]=useState(false);
  const [refreshError,setRefreshError]=useState('');
  const refresh=async()=>{setRefreshing(true);setRefreshError('');try{const r=await apiFetch('/api/events/refresh',{method:'POST'});const d=await r.json();setRefreshError(d.error || '');}catch{setRefreshError('Unable to refresh events');}finally{setRefreshing(false);}};
  const events = items.filter(i=>i.kind==='live' && i.category==='Cricify Events');
  return <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-6 text-white">
    <div className="flex items-start gap-4"><div className="rounded-2xl bg-red-600/15 p-3 text-red-500"><Trophy size={28}/></div>
      <div><p className="text-[11px] text-red-500 font-bold uppercase tracking-[.23em]">MoroShow Sport</p>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Events</h1>
        <p className="text-zinc-400 text-sm mt-2">Only items provided by a connected Cricify-compatible feed. Times and scores are not invented.</p></div>
    </div>
    <button disabled={refreshing} onClick={()=>void refresh()} className="rounded-xl px-4 py-2 bg-white text-black">{refreshing ? "Refreshing…" : "Refresh events"}</button>
    {refreshError && <p role="alert">{refreshError}</p>}
    {events.length ? <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {events.map(item=><MediaTile key={item.id} item={item}/>)}</div> :
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 min-h-52 flex flex-col items-center justify-center gap-3 px-6 py-9 text-center">
        <CalendarClock className="text-zinc-500" size={35}/><p className="font-bold">{isLoading?'Loading events…':'No Cricify events returned'}</p>
        <p className="max-w-lg text-xs sm:text-sm text-zinc-400">{catalogError||'This source must publish a compatible catalog and playable streams. The .cs3 registry alone does not expose match listings.'}</p>
        <div className="inline-flex items-center gap-2 text-xs text-amber-400"><AlertTriangle size={14}/> No fabricated matches or live badges</div>
      </div>}
  </section>;
}
