/** Standalone playback acceptance test; doesn't pretend CloudStream is integrated. */
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Clapperboard, Film, Play, RotateCcw, ShieldCheck, Smartphone, Video } from 'lucide-react';
import { attachWebStream, type NetShowStreamKind } from '../player/webEngine';
import { isNativeIOS, nativePlayerEvents, playNative } from '../native/nativePlayer';

const DEMO_HLS = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

export default function PlayerLab() {
  const [url, setUrl] = useState(DEMO_HLS);
  const [kind, setKind] = useState<NetShowStreamKind>('hls');
  const [message, setMessage] = useState('Ready to test the player.');
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [generation, setGeneration] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const native = isNativeIOS();

  useEffect(() => {
    if (!shouldLoad || native || !video.current) return;
    const node = video.current;
    let dest: string;
    try {
      dest = new URL(url).href;
      if (!/^https?:\/\//.test(dest)) throw new Error('Use HTTPS media URLs.');
    } catch { setError('Enter a valid media URL.'); return; }
    const stop = attachWebStream(node, dest, kind, {
      status: setMessage,
      failure: errorMessage => { setError(errorMessage); setPlaying(false); },
      ready: () => { setMessage('Playback started successfully.'); setPlaying(true); }
    }, true);
    return () => { stop(); setPlaying(false); };
  }, [url, kind, generation, shouldLoad, native]);

  useEffect(() => {
    if (!native) return;
    let cancelled = false;
    const handles: Array<{remove(): Promise<void>}> = [];
    void (async () => {
      const close = await nativePlayerEvents.addListener('closed', () => { setPlaying(false); setMessage('Native player closed.'); });
      const error = await nativePlayerEvents.addListener('playerError', e => { setPlaying(false); setError(e.message || 'iPhone player error.'); });
      if (cancelled) { await close.remove(); await error.remove(); }
      else handles.push(close, error);
    })();
    return () => { cancelled = true; handles.forEach(handle => { void handle.remove(); }); };
  }, [native]);

  const start = async () => {
    setError('');
    setMessage('Opening video…');
    if (native) {
      try {
        if (!url.startsWith('https://')) throw new Error('Installed iPhone apps require HTTPS video URLs.');
        if (kind === 'mpegts') throw new Error('iPhone AVPlayer needs HLS or MP4, not raw MPEG-TS.');
        await playNative({url, title:'MoroShow Player Test', isLive: false});
        setPlaying(true);
        setMessage('Native AVPlayer opened.');
      } catch (err) { setError(err instanceof Error ? err.message : 'Native player failed.'); }
    } else {
      setShouldLoad(true);
      setGeneration(n => n + 1);
    }
  };

  return <div className="min-h-screen bg-[#09090b] text-white px-4 py-6 md:p-9">
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-7">
        <a href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"><ArrowLeft size={16}/> MoroShow Home</a>
        <span className="text-xs border border-red-700/50 rounded-full px-3 py-1 bg-red-600/10 text-red-300">PLAYER LAB · V3.9</span>
      </div>
      <div className="mb-5"><h1 className="text-3xl font-bold tracking-tight"><span className="text-red-600">MOROSHOW</span> PLAYER</h1>
      <p className="text-zinc-400 mt-2">Independent player check before connecting content providers. This public demo video is for testing only.</p></div>
      <div className="bg-[#16161a] border border-white/10 overflow-hidden rounded-2xl">
        <div className="aspect-video relative bg-black">
          {native ? <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-400"><Smartphone size={48}/><p>Open the native iPhone player using the button below</p></div> :
            <video ref={video} controls playsInline preload="none" className="w-full h-full object-contain" />}
          {!shouldLoad && !native && <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center gap-4"><Clapperboard size={48} className="text-red-600"/><p className="text-zinc-400 text-sm">Ready for HLS / MP4 / MPEG-TS</p></div>}
        </div>
        <div className="p-4 md:p-6 space-y-4">
          <div className="flex gap-2 flex-wrap text-xs text-zinc-400"><span className="border border-white/15 rounded-full px-3 py-1">{native ? 'Native AVPlayer · iOS' : 'HLS.js · Chrome / Web'}</span><span className="border border-white/15 rounded-full px-3 py-1">{playing ? 'Video playing' : 'Waiting'}</span></div>
          <label className="block text-xs font-semibold text-zinc-300" htmlFor="media-url">Media URL (use a stream you are authorized to play)</label>
          <input id="media-url" spellCheck={false} value={url} onChange={e => { setUrl(e.target.value); setShouldLoad(false); }} className="w-full rounded-lg bg-black/60 text-sm text-zinc-200 px-3 py-3 border border-white/15 focus:border-red-600 outline-none" />
          <div className="flex flex-wrap gap-3 items-center">
            <select aria-label="Stream format" value={kind} onChange={e => { setKind(e.target.value as NetShowStreamKind); setShouldLoad(false); }} className="bg-[#26262b] rounded-lg px-3 py-3 text-sm border border-white/10">
              <option value="hls">HLS · .m3u8</option><option value="mp4">MP4</option><option value="mpegts">MPEG-TS (Chrome only)</option>
            </select>
            <button onClick={() => void start()} className="bg-red-600 hover:bg-red-700 px-5 py-3 rounded-lg text-sm font-bold inline-flex items-center gap-2"><Play size={16}/> Test Playback</button>
            <button onClick={() => { setUrl(DEMO_HLS); setKind('hls'); setError(''); setShouldLoad(false); setMessage('Demo reset.'); }} className="bg-zinc-800 hover:bg-zinc-700 px-4 py-3 rounded-lg text-sm inline-flex items-center gap-2"><RotateCcw size={15}/> Demo</button>
          </div>
          <div aria-live="polite" className={`rounded-lg px-4 py-3 text-sm border ${error ? 'bg-red-950/40 border-red-600/40 text-red-200' : 'bg-zinc-900 border-white/10 text-zinc-300'}`}>{error || message}</div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-5 text-xs text-zinc-500"><span className="inline-flex items-center gap-2"><Film size={15}/> Public sample stream only</span><span className="inline-flex items-center gap-2"><ShieldCheck size={15}/> No provider passwords in the app</span><span className="inline-flex items-center gap-2"><Video size={15}/> Does not imply CloudStream compatibility</span></div>
    </div>
  </div>;
}
