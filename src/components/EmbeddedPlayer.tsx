import {useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeft, RotateCw} from 'lucide-react';
import {useCatalog} from '../context/CatalogContext';
import {useProfile} from '../context/ProfileContext';
import {resolveMediaUrl} from '../player/netshowApi';
import {movieEmbedPlayback} from '../player/browserPlayback';
import {embedStartUrl, numberMovieSources, PRIMARY_MOVIE_SOURCE_ID} from '../player/embedPresentation';
import {ProtectedEmbeddedPlayer} from './ProtectedEmbeddedPlayer';
import {useDialog} from './useDialog';

const playerStyle = `.m-browser-player{position:fixed;inset:0;background:#050505;overflow:hidden}
.m-browser-player .m-player-toolbar{position:absolute;z-index:4;top:env(safe-area-inset-top,0px);left:0;right:0;min-height:76px;padding:18px clamp(18px,4vw,52px);background:linear-gradient(180deg,rgba(0,0,0,.88),transparent);pointer-events:none;display:flex;gap:20px;align-items:center}
.m-browser-player .m-player-toolbar>span{font-size:clamp(16px,2vw,22px);font-weight:650;letter-spacing:.01em;color:#fff;text-shadow:0 1px 8px #000}
.m-browser-player .m-player-toolbar button{pointer-events:auto;width:44px;height:44px;display:grid;place-items:center;border-radius:50%;background:#ffffff18;border:1px solid #ffffff30;color:white;transition:background .2s,transform .2s}
.m-browser-player .m-player-toolbar button:hover{background:#ffffff35;transform:scale(1.05)}
.m-browser-player .m-player-servers{position:absolute;z-index:4;top:88px;left:clamp(18px,4vw,52px);display:flex;gap:8px;padding:6px 8px;border:1px solid #ffffff1c;border-radius:999px;background:#1119;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
.m-browser-player .m-player-servers button{padding:9px 16px;border:1px solid #ffffff30;border-radius:999px;background:transparent;color:#eee;font-size:13px;font-weight:600;transition:all .2s}
.m-browser-player .m-player-servers button.selected{background:#fff;color:#111;border-color:#fff;box-shadow:0 2px 14px #0008}
.m-browser-player video,.m-browser-player iframe{position:absolute;inset:0;width:100%;height:100%;min-height:0;border:0}
.m-browser-player video{object-fit:contain}
.m-browser-player .m-player-help{position:absolute;z-index:5;left:50%;bottom:max(64px,calc(48px + env(safe-area-inset-bottom,0px)));transform:translateX(-50%);width:min(560px,calc(100% - 32px));justify-content:center;align-items:center;gap:12px;padding:12px 18px;border:1px solid #ffffff20;border-radius:14px;background:#111d;color:#f1f1f1;font-size:13px;line-height:1.5;backdrop-filter:blur(16px)}
.m-browser-player .m-player-help button{padding:9px 14px;border-radius:9px;background:#fff;color:#111;font-weight:650;white-space:nowrap}
.m-browser-player .m-embed-start{position:absolute;inset:0;z-index:3;display:grid;place-content:center;justify-items:center;gap:10px;background:radial-gradient(ellipse at center,#181818,#050505 68%)}
.m-browser-player .m-embed-start p{color:#ccc;font-size:14px;text-align:center}
@media(max-width:640px){.m-browser-player .m-player-toolbar{min-height:62px;padding:12px 14px}
.m-browser-player .m-player-toolbar button{width:42px;height:42px}
.m-browser-player .m-player-servers{top:70px;left:14px;right:14px;justify-content:flex-start;overflow-x:auto;width:max-content;max-width:calc(100% - 28px)}
.m-browser-player .m-player-servers button{padding:9px 14px}
.m-browser-player .m-player-help{bottom:calc(56px + env(safe-area-inset-bottom,0px));font-size:12px}}
`;

function EmbedFallback({url, title, startAt}: {
  url: string;
  title: string;
  startAt: number;
}) {
  const [config] = useState(() => movieEmbedPlayback(embedStartUrl(url, startAt)));

  return <iframe
    src={config.url}
    title={title}
    tabIndex={0}
    sandbox={config.sandbox}
    referrerPolicy={config.referrerPolicy}
    allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
    allowFullScreen
  />;
}

export function EmbeddedPlayer() {
  const {activePlayback, stopPlayback, startPlayback, playbackLoading, playbackError} = useCatalog();
  const {recordHistory, history} = useProfile();
  const [retry, setRetry] = useState(0);
  const retryPosition = useRef<{key: string; time: number} | undefined>(undefined);
  const video = useRef<HTMLVideoElement>(null);
  const dialog = useDialog(!!activePlayback, stopPlayback);

  if (!activePlayback) return null;
  const {catalogItem: item, tokenResponse: token, resumeTime} = activePlayback;
  const directOnly = token.playbackMode === 'direct-only';
  const type = token.streamType;
  const saved = history.find(entry => entry.contentId === item.id && entry.progressPercent < 95);
  const startAt = resumeTime ?? saved?.currentTime ?? 0;
  let url = '';
  try {
    if (token.streamUrl && (type === 'hls' || type === 'mp4')) {
      url = resolveMediaUrl(token.streamUrl);
    }
  } catch {
    // An invalid media address is presented as an unavailable source.
  }
  let embed = '';
  if (!directOnly && !url && token.embedUrl) {
    try {
      embed = movieEmbedPlayback(token.embedUrl).url;
    } catch {
      // Unsupported player addresses cannot be embedded.
    }
  }
  const variants = numberMovieSources([
    ...(directOnly ? [] : [{id: PRIMARY_MOVIE_SOURCE_ID}]),
    ...(token.variants ?? []).filter(source => directOnly
      ? source.kind === 'direct'
      : source.id !== PRIMARY_MOVIE_SOURCE_ID && (source.kind === 'direct' || (url && source.id === token.variantId))),
  ]);
  const sourceKey = JSON.stringify([item.id, token.variantId, url || embed]);
  const playerKey = JSON.stringify([sourceKey, retry]);
  const initialPosition = retryPosition.current?.key === sourceKey ? retryPosition.current.time : startAt;
  const position = () => video.current && video.current.readyState > 0 ? video.current.currentTime : initialPosition;
  const selectSource = (id: string) => {
    if (id === token.variantId && (url || embed)) return;
    const current = position();
    retryPosition.current = undefined;
    void startPlayback(item, current, id);
  };
  const reload = () => {
    retryPosition.current = {key: sourceKey, time: position()};
    setRetry(value => value + 1);
  };
  const save = (streamType: 'hls' | 'mp4', currentTime: number, duration: number) => {
    void recordHistory({
      contentId: item.id, name: item.name, kind: item.kind, category: item.category,
      posterUrl: item.logoUrl, streamUrl: '', streamType, currentTime, duration,
    });
  };

  return createPortal(
    <div ref={dialog} className="m-player m-browser-player" role="dialog" aria-modal="true" aria-label="Video player">
      <style>{playerStyle}</style>
      <div className="m-player-toolbar">
        <button onClick={stopPlayback} aria-label="Back to browsing"><ArrowLeft size={22}/></button>
        <span>{item.seriesTitle || item.name}</span>
        {(url || embed) && <button aria-label="Reload player" onClick={reload}><RotateCw size={20}/></button>}
      </div>
      {variants.length > 0 && <div className="m-player-servers" aria-label="Playback sources">
        {variants.map(source => <button
          key={source.id}
          className={source.id === token.variantId ? 'selected' : ''}
          aria-pressed={source.id === token.variantId}
          disabled={playbackLoading}
          onClick={() => selectSource(source.id)}
        >{source.label}</button>)}
      </div>}
      {url && (type === 'hls' || type === 'mp4') ? <ProtectedEmbeddedPlayer
        key={playerKey}
        url={url}
        type={type}
        title={item.name}
        startAt={initialPosition}
        videoRef={video}
        onProgress={(time, duration) => save(type, time, duration)}
      /> : embed ? <EmbedFallback
        key={playerKey}
        url={embed}
        title={item.name}
        startAt={initialPosition}
      /> : <div className="m-embed-start"><p role="status">{token.playbackNote || 'No playback source is available for this title.'}</p></div>}
      {playbackLoading && <p role="status" className="m-player-help">Switching source…</p>}
      {playbackError && <p role="alert" className="m-player-help">{playbackError}</p>}
    </div>, document.body,
  );
}
