import { apiFetch } from '../player/netshowApi';
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, PlugZap, Film, Tv, Radio, Trophy } from 'lucide-react';

type SourceStatus = {
  id: 'cnc-verse' | 'streamplay' | 'yacintv' | 'cricify';
  name: string;
  sections: ('movies'|'series'|'live'|'events')[];
  listed: boolean;
  version: number | null;
  reportedTypes: string[];
  playable: false;
  message: string;
};
type SourcesResponse = {
  success: boolean;
  sources?: SourceStatus[];
  warnings?: string[];
  error?: string;
  playbackConnected?: false;
};

const sectionIcons = {
  movies: Film, series: Tv, live: Radio, events: Trophy,
};

export default function CloudStreamSourcesPanel() {
  const [data, setData] = useState<SourcesResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [gateway, setGateway] = useState<any>(null);
  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const res = await apiFetch('/api/netshow/sources', { cache: 'no-store' });
      const next: SourcesResponse = await res.json();
      setData(next);
      const health = await apiFetch('/api/source-status', {cache:'no-store'}).then(x=>x.json());
      setGateway(health);
    } catch (_) {
      setData({ success: false, error: 'MoroShow backend unavailable. Start the local server first.' });
    } finally { setBusy(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return (
    <section className="space-y-5 text-zinc-100">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold text-white text-lg flex items-center gap-2"><PlugZap size={20} className="text-red-500" /> Selected Sources</h3>
          <p className="text-xs text-zinc-500 mt-1">CNC Bridge connection and catalog import status.</p>
        </div>
        <button type="button" disabled={busy} onClick={() => void refresh()} className="rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-3 py-2 text-xs font-bold flex items-center gap-1.5"><RefreshCw size={14} className={busy ? 'animate-spin' : ''}/> Verify</button>
      </div>
      {gateway && <div className="rounded-xl border border-white/10 bg-zinc-900 px-4 py-4 space-y-2">
        <h4 className="font-bold text-sm">Content connection — {gateway.ready ? 'Catalog imported (playback checked separately)' : 'Not connected'}</h4>
        <p className="text-xs text-zinc-400">Movies: {gateway.counts?.movies||0} · Series: {gateway.counts?.series||0} · Live: {gateway.counts?.live||0}</p>
        {(gateway.gateway||[]).map((g:any)=><p key={g.source} className="text-xs text-zinc-400"><span className={g.status==='connected'?'text-emerald-400':'text-amber-400'}>{g.source}: {g.status}</span> — {g.items} items {g.error?'('+g.error+')':''}</p>)}
        {gateway.error && <p className="text-xs text-amber-300">{gateway.error}</p>}
      </div>}
      <div className="rounded-xl border border-amber-500/30 bg-amber-900/10 px-4 py-3 text-xs leading-relaxed text-zinc-300 flex gap-2">
        <AlertTriangle size={17} className="shrink-0 text-amber-400" />
        <p>These checks verify CloudStream plugin metadata only. A published Android .cs3 plugin is <strong>not</strong> a playable browser source. The read-only repository check does not import media. Any real catalog imports are shown in the Gateway panel above. Playback needs a compatible implementation and authorized media access.</p>
      </div>
      {data?.success ? <>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(data.sources || []).map(item => (
            <div key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-4 py-3 space-y-2">
              <div className="flex items-center justify-between gap-2"><h4 className="font-bold text-sm">{item.name}</h4><span className={`text-[10px] px-2 py-1 rounded-full border ${item.listed ? 'border-emerald-500/30 text-emerald-400 bg-emerald-950/20' : 'border-amber-500/30 text-amber-300'}`}>{item.listed ? 'Listed' : 'Not verified'}</span></div>
              <div className="flex flex-wrap gap-1.5">{item.sections.map(section => { const Icon = sectionIcons[section]; return <span key={section} className="inline-flex items-center gap-1 text-[10px] text-zinc-300 bg-zinc-800 rounded px-2 py-1"><Icon size={11}/>{section}</span>; })}</div>
              <p className="text-xs leading-relaxed text-zinc-400">{item.message}</p>
              {item.version !== null && <p className="text-[10px] text-zinc-500">Plugin version {item.version}</p>}
            </div>
          ))}
        </div>
        {(data.warnings || []).length > 0 && <p className="text-xs text-amber-300">Repository warnings: {data.warnings?.join(' • ')}</p>}
        <div className="flex items-center gap-2 text-xs text-zinc-400"><CheckCircle2 size={16} className="text-emerald-400"/>Source registry checked. Real playback is independently verified by the gateway above.</div>
      </> : data && !data.success ? <p className="text-xs text-red-300">{data.error || 'Source check failed'}</p> : <p className="text-sm text-zinc-400">Checking selected repositories…</p>}
    </section>
  );
}
