import { useEffect, useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { useCatalog } from '../context/CatalogContext';
import { useProfile } from '../context/ProfileContext';
import { orderEmbedVariants } from '../player/embedPresentation';
import { apiFetch } from '../player/netshowApi';
import { isIOSDevice } from '../player/shortsPresentation';
import { isVodPreview } from '../player/vodPreview';
import type { StreamTokenResponse } from '../types';
import { useDialog } from './useDialog';

type Variant = { id: string; label: string };
const embedded = ['vidstuck', 'videasy', 'cinesrc', 'vidlink'].map(id => ({ id, label: '' }));
const directLabels: Record<string, string> = { moviebox: 'MovieBox · MP4', cinepro: 'CinePro', icefy: 'Icefy · HLS' };
const shortLabels: Record<string, string> = { dramabox: 'DramaBox', goodshort: 'GoodShort', reelshort: 'ReelShort' };

export function ServerPicker() {
  const { pendingPlayback, pendingResumeTime, setPendingPlayback, startPlayback, playbackLoading, playbackError, stopPlayback } = useCatalog();
  const { activeProfile } = useProfile();
  const [result, setResult] = useState<{ key: string; variants?: Variant[]; error?: string }>();
  const [attempt, setAttempt] = useState(0);
  const close = () => { stopPlayback(); setPendingPlayback(null); };
  const ref = useDialog(!!pendingPlayback, close);
  const contentId = pendingPlayback?.id;
  const profileId = activeProfile?.id;
  const preview = isVodPreview() && !!contentId?.startsWith('w32:');
  const key = JSON.stringify([contentId, profileId, attempt]);

  useEffect(() => {
    if (!preview || !profileId) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setResult({ key, error: 'The server took too long to load sources.' });
      controller.abort();
    }, 35_000);
    void (async () => {
      try {
        const res = await apiFetch('/api/stream/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contentId, profileId, variantId: 'cinesrc', directVod: true }),
          signal: controller.signal,
        });
        const data: StreamTokenResponse = await res.json();
        if (!res.ok || !data.success || !data.variants?.length) throw new Error(data.error || 'Could not load sources.');
        if (!controller.signal.aborted) setResult({ key, variants: data.variants });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key, error: error instanceof Error ? error.message : 'Could not load sources.' });
      } finally {
        window.clearTimeout(timeout);
      }
    })();
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [contentId, key, preview, profileId]);

  if (!pendingPlayback) return null;
  const shortProvider = /^short:(dramabox|goodshort|reelshort):/.exec(pendingPlayback.id)?.[1];
  const listing = result?.key === key ? result : undefined;
  const loadingSources = preview && !listing;
  let servers: Variant[];
  if (pendingPlayback.id.startsWith('drama:')) servers = [{ id: 'shorts', label: 'Shorts' }];
  else if (shortProvider) servers = [{ id: shortProvider, label: shortLabels[shortProvider] }];
  else servers = orderEmbedVariants(preview ? listing?.variants ?? [] : embedded, isIOSDevice(navigator))
    .map((variant, index) => ({ ...variant, label: directLabels[variant.id] ?? `Source ${index + 1}` }));

  return <div className="m-overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="server-title" className="m-server-card">
      <button className="m-close" aria-label="Close source selection" onClick={close}><X/></button>
      <p className="m-eyebrow">READY WHEN YOU ARE</p>
      <h2 id="server-title">Choose a source</h2>
      <p className="m-muted">{pendingPlayback.seriesTitle || pendingPlayback.name}{pendingPlayback.episode ? ` · S${pendingPlayback.season} E${pendingPlayback.episode}` : ''}</p>
      <div className="m-server-list">{servers.map(({ id, label }, index) =>
        <button key={id} disabled={playbackLoading} onClick={() => void startPlayback(pendingPlayback, pendingResumeTime, id)}>
          <span className="m-server-num">{String(index + 1).padStart(2, '0')}</span>
          <span>{label}{index === 0 && <small>Default</small>}</span><ChevronRight size={20}/>
        </button>)}</div>
      {loadingSources && <p role="status">Loading sources…</p>}
      {listing?.error && <div role="alert"><p className="m-error">{listing.error}</p><button className="m-secondary" onClick={() => setAttempt(n => n + 1)}>Retry sources</button></div>}
      {playbackLoading && <p role="status">Opening player…</p>}
      {playbackError && <p role="alert" className="m-error">{playbackError}</p>}
      <p className="m-help">Subtitles and audio options are available inside the player.</p>
    </div>
  </div>;
}
