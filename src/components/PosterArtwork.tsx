import { useProfile } from '../context/ProfileContext';
import { apiFetch } from '../player/netshowApi';
import React, { useEffect, useRef, useState } from 'react';
import { Clapperboard, Tv } from 'lucide-react';
import type { CatalogItem } from '../types';

type Art = { posterUrl?: string; backdropUrl?: string; overview?: string };
const cache = new Map<string, Art>();
const inflight = new Map<string, Promise<Art>>();
const queue: Array<() => void> = [];
let running = 0;
function withLimit<T>(job: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    queue.push(() => {
      running++;
      job().then(resolve, reject).finally(() => { running--; queue.shift()?.(); });
    });
    if (running < 3 && queue.length <= 3) queue.shift()?.();
  });
}
async function getArt(contentId: string, profileId: string): Promise<Art> {
  const id=profileId+":"+contentId;
  if (cache.has(id)) return cache.get(id)!;
  if (!inflight.has(id)) {
    const promise = withLimit(async () => {
      const response = await apiFetch(`/api/media/${encodeURIComponent(contentId)}/artwork?profileId=${encodeURIComponent(profileId)}`);
      if (!response.ok) return {};
      const data = await response.json();
      return data?.success ? { posterUrl: data.posterUrl, backdropUrl: data.backdropUrl, overview: data.overview } : {};
    }).catch(() => ({} as Art)).then(value => { if (value.posterUrl || value.backdropUrl) cache.set(id, value); return value; }).finally(() => inflight.delete(id));
    inflight.set(id, promise);
  }
  return inflight.get(id)!;
}

export function PosterArtwork({ item, className = '' }: { item: CatalogItem; className?: string }) {
  const {activeProfile}=useProfile();
  const host = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [art, setArt] = useState<Art>({});
  const [failed, setFailed] = useState(false);
  const [tried, setTried] = useState<string[]>([]);
  const isPoster = item.kind !== 'live';
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setNear(true); observer.disconnect(); }
    }, { rootMargin: '260px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [item.id]);
  useEffect(() => { setArt({}); setFailed(false); setTried([]); }, [item.id]);
  useEffect(() => {
    if (!near || item.kind === 'live' || (item.logoUrl && !failed)) return;
    let cancelled = false;
    getArt(item.id, activeProfile?.id || '').then(data => { if (!cancelled) setArt(data); });
    return () => { cancelled = true; };
  }, [near, item.id, item.kind, item.logoUrl, failed, activeProfile?.id]);
  useEffect(() => { if (art.posterUrl) setFailed(false); }, [art.posterUrl]);
  const candidates = [...new Set([
    art.posterUrl, art.backdropUrl, item.logoUrl, item.backdropUrl
  ].filter((x): x is string => !!x && /^https?:\/\//i.test(x)))];
  const url = candidates.find(candidate => !tried.includes(candidate));
  const showImage = near && !!url;
  return <div ref={host} className={`relative bg-gradient-to-br from-zinc-900 via-[#1d1720] to-neutral-800 flex items-center justify-center overflow-hidden ${className}`}>
    {showImage ? <img src={url} alt={item.name} loading="lazy" decoding="async" referrerPolicy="no-referrer"
      onError={() => { setTried(prev => [...prev, url!]); if (candidates.every(u => u === url || tried.includes(u))) setFailed(true); }}
      className={`absolute inset-0 h-full w-full ${isPoster ? 'object-cover' : 'object-contain p-4'} transition-transform duration-300 group-hover/card:scale-105`} /> :
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-3 gap-3">
        {isPoster ? <Clapperboard className="text-red-500/65 w-8 h-8" /> : <Tv className="text-red-500/65 w-8 h-8" />}
        <span className="text-xs text-white/85 font-bold line-clamp-4 leading-snug">{item.name}</span>
      </div>}
  </div>;
}
