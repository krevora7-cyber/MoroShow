import Artplayer from 'artplayer';
import { isNativeIOS, nativePlayerEvents, playNative } from '../native/nativePlayer';
import { resolveMediaUrl } from '../player/netshowApi';
import { orderEmbedVariants } from '../player/embedPresentation';
import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import { useCatalog } from '../context/CatalogContext';
import { useProfile } from '../context/ProfileContext';
import { CatalogItem } from '../types';
import { ArrowLeft, Radio, ListVideo, AlertCircle, RefreshCw } from 'lucide-react';

declare global {
  interface Window {
    Artplayer?: any;
  }
}

export const VideoPlayer: React.FC = () => {
  const { activePlayback, stopPlayback, liveChannels, startPlayback, playbackLoading, playbackError } = useCatalog();
  const { recordHistory, history } = useProfile();

  const artContainerRef = useRef<HTMLDivElement>(null);
  const artInstanceRef = useRef<any>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<mpegts.Player | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isChannelGuideOpen, setIsChannelGuideOpen] = useState(false);

  const tokenData = activePlayback?.tokenResponse;
  const item = activePlayback?.catalogItem;
  const sourceVariants = orderEmbedVariants(tokenData?.variants || item?.variants || [], false)
    .map((variant, index) => ({ ...variant, label: variant.id === 'moviebox' ? 'MovieBox · MP4' : variant.id.startsWith('demo-') ? variant.label : `Source ${index + 1}` }));
  const isLive = item?.kind === 'live';
  const saved = history.find(entry => entry.contentId === item?.id && entry.progressPercent < 95);
  const startAt = activePlayback?.resumeTime ?? saved?.currentTime ?? 0;

  const destroyEngines = () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (mpegtsRef.current) {
      try {
        mpegtsRef.current.pause();
        mpegtsRef.current.unload();
        mpegtsRef.current.detachMediaElement();
        mpegtsRef.current.destroy();
      } catch {}
      mpegtsRef.current = null;
    }
    if (artInstanceRef.current) {
      try {
        artInstanceRef.current.destroy(false);
      } catch {}
      artInstanceRef.current = null;
    }
  };

  const handleClose = () => {
    if (item && !isLive && artInstanceRef.current) {
      const currentTime = Number(artInstanceRef.current.currentTime || 0);
      const duration = Number(artInstanceRef.current.duration || 0);
      if (duration > 0) {
        void recordHistory({
          contentId: item.id,
          name: item.name,
          streamUrl: '',
          streamType: tokenData?.streamType ?? item.streamType,
          kind: item.kind,
          category: item.category,
          posterUrl: item.backdropUrl || item.logoUrl,
          currentTime,
          duration
        });
      }
    }
    destroyEngines();
    stopPlayback();
  };

  const handleSourceSelect = (variantId: string) => {
    if (!item || !activePlayback || variantId === tokenData?.variantId) return;
    const resume = !isLive && artInstanceRef.current
      ? Number(artInstanceRef.current.currentTime || 0)
      : undefined;
    void startPlayback(item, resume, variantId);
  };

  const handleSwitchLiveChannel = (ch: CatalogItem) => {
    void startPlayback(ch);
    setIsChannelGuideOpen(false);
  };

  const initArtPlayer = () => {
    if (!artContainerRef.current || !tokenData || !item) return;
    if (!Artplayer) {
      setErrorMessage('Player is loading, please retry in a moment.');
      return;
    }

    destroyEngines();
    setErrorMessage(null);

    try {
    const streamUrl = resolveMediaUrl(tokenData.streamUrl);
    const streamType = tokenData.streamType;
    const subs = tokenData.subtitles || [];
    const settingsList: any[] = [];

    if (sourceVariants.length > 1) {
      settingsList.push({
        width: 220,
        html: 'Server / Quality',
        tooltip: sourceVariants.find(v => v.id === tokenData.variantId)?.label || 'Default',
        selector: sourceVariants.map(v => ({
          default: v.id === tokenData.variantId,
          html: v.label,
          variantId: v.id
        })),
        onSelect: (selected: any) => {
          handleSourceSelect(selected.variantId);
          return selected.html;
        }
      });
    }

    if (subs.length > 0) {
      settingsList.push({
        width: 200,
        html: 'Subtitles',
        tooltip: subs[0]?.label || 'On',
        selector: [
          { html: 'Off', url: '' },
          ...subs.map((s, idx) => ({
            default: idx === 0,
            html: s.label || s.lang || `Subtitle ${idx + 1}`,
            url: resolveMediaUrl(s.url)
          }))
        ],
        onSelect: (selected: any) => {
          if (!selected.url) {
            artInstanceRef.current.subtitle.show = false;
          } else {
            artInstanceRef.current.subtitle.switch(selected.url, { name: selected.html });
            artInstanceRef.current.subtitle.show = true;
          }
          return selected.html;
        }
      });
    }

    const art = new (Artplayer as any)({
      container: artContainerRef.current,
      url: streamUrl,
      type: streamType === 'hls' ? 'm3u8' : streamType === 'mpegts' ? 'ts' : 'mp4',
      poster: item.backdropUrl || item.logoUrl || '',
      volume: 0.85,
      isLive,
      muted: false,
      autoplay: true,
      pip: true,
      autoSize: false,
      autoMini: true,
      screenshot: !isLive,
      setting: true,
      flip: true,
      playbackRate: !isLive,
      aspectRatio: true,
      fullscreen: true,
      fullscreenWeb: true,
      subtitleOffset: true,
      miniProgressBar: true,
      mutex: true,
      backdrop: true,
      playsInline: true,
      theme: '#ffffff',
      lang: 'en',
      subtitle: subs.length > 0 ? {
        ...(Artplayer as any).option.subtitle,
        url: resolveMediaUrl(subs[0].url),
        type: 'vtt',
        encoding: 'utf-8',
        escape: true,
        style: {
          color: '#ffffff',
          fontSize: '24px',
          textShadow: '0 2px 4px rgba(0,0,0,0.85)'
        }
      } : { ...(Artplayer as any).option.subtitle },
      settings: settingsList,
      customType: {
        m3u8: (video: HTMLVideoElement, url: string) => {
          if (Hls.isSupported()) {
            if (hlsRef.current) hlsRef.current.destroy();
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: isLive,
              backBufferLength: isLive ? 30 : 90
            });
            hls.loadSource(url);
            hls.attachMedia(video);
            hlsRef.current = hls;

            hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
              if (data.levels.length > 1) {
                const qualities = data.levels.map((lvl, idx) => ({
                  default: idx === hls.currentLevel,
                  html: lvl.height ? `${lvl.height}p` : `Level ${idx + 1}`,
                  level: idx
                }));
                art.setting.add({
                  name: 'hls-quality',
                  width: 180,
                  html: 'Resolution',
                  tooltip: 'Auto',
                  selector: [{ default: true, html: 'Auto', level: -1 }, ...qualities],
                  onSelect: (q: any) => {
                    hls.currentLevel = q.level;
                    return q.html;
                  }
                });
              }
            });

            hls.on(Hls.Events.AUDIO_TRACKS_UPDATED,(_,data)=>{
              if(!data.audioTracks.length)return;
              const option={name:'audio-tracks',html:'Audio',selector:data.audioTracks.map((t,i)=>({html:t.name||t.lang||`Audio ${i+1}`,track:i})),onSelect:(v:any)=>{hls.audioTrack=v.track;return v.html;}};
              if(art.setting.find('audio-tracks'))art.setting.update(option);else art.setting.add(option);
            });
            hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED,(_,data)=>{
              if(!data.subtitleTracks.length)return;
              const option={name:'embedded-subtitles',html:'Embedded subtitles',selector:[{html:'Off',track:-1},...data.subtitleTracks.map((t,i)=>({html:t.name||t.lang||`Subtitle ${i+1}`,track:i}))],onSelect:(v:any)=>{hls.subtitleTrack=v.track;return v.html;}};
              if(art.setting.find('embedded-subtitles'))art.setting.update(option);else art.setting.add(option);
            });
            hls.on(Hls.Events.ERROR, (_, data) => {
              if (data.fatal) {
                setErrorMessage('Stream interrupted or unavailable. Try another quality or retry.');
              }
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
          } else {
            setErrorMessage('HLS playback is not supported on this browser.');
          }
        },
        ts: (video: HTMLVideoElement, url: string) => {
          if (mpegts.isSupported()) {
            if (mpegtsRef.current) mpegtsRef.current.destroy();
            const player = mpegts.createPlayer(
              { type: 'mpegts', isLive, url },
              { enableWorker: true, lazyLoad: false, liveBufferLatencyChasing: true }
            );
            player.attachMediaElement(video);
            player.load();
            player.play();
            player.on(mpegts.Events.ERROR, () => {
              setErrorMessage('Live stream error. Please retry or switch quality.');
            });
            mpegtsRef.current = player;
          } else {
            setErrorMessage('MPEG-TS is not supported on this device.');
          }
        }
      }
    });

    art.on('ready', () => {
      if (startAt > 0 && !isLive) {
        art.seek = startAt;
      }
      art.play().catch(() => {});
    });

    art.on('error', () => {
      setErrorMessage('Unable to play this video source. Please retry or select another quality.');
    });

    artInstanceRef.current = art;
    } catch {
      destroyEngines();
      setErrorMessage("The player could not start. Close and retry playback.");
    }
  };

  useEffect(() => {
    if (!isNativeIOS() || tokenData?.subtitles?.length) {
      initArtPlayer();
    }
    return () => {
      destroyEngines();
    };
  }, [tokenData?.token]);

  useEffect(() => {
    if (!isNativeIOS() || !tokenData || !item || tokenData.subtitles?.length) return;
    let cancelled = false;
    const listeners: Array<{ remove(): Promise<void> }> = [];
    void (async () => {
      try {
        const closed = await nativePlayerEvents.addListener('closed', () => {
          if (!cancelled) stopPlayback();
        });
        listeners.push(closed);
        await playNative({
          url: resolveMediaUrl(tokenData.streamUrl),
          title: item.name,
          isLive,
          startAt
        });
      } catch (e) {
        if (!cancelled) setErrorMessage(e instanceof Error ? e.message : 'Unable to launch iOS player.');
      }
    })();
    return () => {
      cancelled = true;
      listeners.forEach(l => { void l.remove(); });
      void nativePlayerEvents.stop();
    };
  }, [tokenData?.token]);

  useEffect(() => {
    if (!item || isLive) return;
    const interval = setInterval(() => {
      const art = artInstanceRef.current;
      if (art && art.playing && Number(art.duration) > 0) {
        void recordHistory({
          contentId: item.id,
          name: item.name,
          streamUrl: '',
          streamType: tokenData?.streamType ?? item.streamType,
          kind: item.kind,
          category: item.category,
          posterUrl: item.backdropUrl || item.logoUrl,
          currentTime: Number(art.currentTime || 0),
          duration: Number(art.duration || 0)
        });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [item?.id, isLive]);

  if (!activePlayback || !item) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col select-none overflow-hidden">
      {/* Top Overlay */}
      <div className="absolute top-0 inset-x-0 p-4 sm:p-5 bg-gradient-to-b from-black/85 to-transparent flex items-center justify-between z-30 pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          <button
            type="button"
            aria-label="Exit video player"
            onClick={handleClose}
            className="p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/15 backdrop-blur-md transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white drop-shadow">{item?.name}</h2>
              {isLive && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black uppercase">
                  <Radio className="w-2.5 h-2.5 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400">{item?.category}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {sourceVariants.length > 1 && (
            <select
              aria-label="Select playback source"
              disabled={playbackLoading}
              value={tokenData?.variantId || ''}
              onChange={e => handleSourceSelect(e.target.value)}
              className="bg-black/75 border border-white/20 text-white text-xs rounded-xl px-3 py-2 backdrop-blur-md"
            >
              {sourceVariants.map(v => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
          )}

          {isLive && (
            <button
              type="button"
              onClick={() => setIsChannelGuideOpen(prev => !prev)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-black/75 hover:bg-neutral-800 text-white border border-white/20 backdrop-blur-md text-xs font-bold"
            >
              <ListVideo className="w-4 h-4 text-emerald-400" />
              <span>Channels ({liveChannels.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* ArtPlayer Container */}
      <div ref={artContainerRef} className="w-full h-full flex-1" />

      {(playbackLoading || playbackError) && <p role={playbackError ? 'alert' : 'status'} className="absolute bottom-16 inset-x-4 z-50 mx-auto w-fit rounded bg-black/90 px-4 py-2 text-white">{playbackError || 'Switching source…'}</p>}

      {/* Error Overlay */}
      {errorMessage && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/85 backdrop-blur-md p-6 z-40">
          <div className="max-w-md w-full bg-neutral-900 border border-red-500/30 rounded-2xl p-6 text-center shadow-2xl">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">Playback Interrupted</h3>
            <p className="text-sm text-neutral-400 mb-5">{errorMessage}</p>
            {sourceVariants.length > 1 && (
              <select
                aria-label="Switch playback source"
                disabled={playbackLoading}
                value={tokenData?.variantId || ''}
                onChange={e => handleSourceSelect(e.target.value)}
                className="w-full bg-neutral-800 text-white p-3 rounded-xl mb-4 text-xs"
              >
                {sourceVariants.map(v => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </select>
            )}
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={playbackLoading}
                onClick={() => void startPlayback(item, Number(artInstanceRef.current?.currentTime || startAt), tokenData?.variantId)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-sm transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live TV Channel Guide Drawer */}
      {isChannelGuideOpen && isLive && (
        <div className="absolute top-0 right-0 bottom-0 w-80 sm:w-96 bg-neutral-950/95 border-l border-neutral-800 backdrop-blur-xl p-4 z-40 flex flex-col shadow-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-red-500 animate-pulse" />
              Live TV Channels
            </h3>
            <button
              type="button"
              onClick={() => setIsChannelGuideOpen(false)}
              className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {liveChannels.map((channel) => {
              const isCurrent = item?.id === channel.id;
              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => handleSwitchLiveChannel(channel)}
                  className={`w-full text-left p-3 rounded-xl border flex items-center gap-3 transition-all ${
                    isCurrent
                      ? 'bg-emerald-600/20 border-emerald-500/60 ring-1 ring-emerald-500'
                      : 'bg-neutral-900/60 border-neutral-800/80 hover:bg-neutral-800'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${isCurrent ? 'text-emerald-400' : 'text-white'}`}>
                      {channel.name}
                    </p>
                    <p className="text-xs text-neutral-400 truncate mt-0.5">{channel.category}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
