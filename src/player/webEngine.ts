import Hls from 'hls.js';
import mpegts from 'mpegts.js';

export type NetShowStreamKind = 'hls' | 'mp4' | 'mpegts';
export type WebPlaybackCallbacks = {
  status: (message: string) => void;
  failure: (message: string) => void;
  ready?: () => void;
};

/** Browser engine for licensed HLS/MP4/TS streams. Returns a synchronous teardown.
 * The caller owns media element lifecycle. No content scraping or DRM bypass.
 */
export function attachWebStream(
  video: HTMLVideoElement,
  url: string,
  kind: NetShowStreamKind,
  callbacks: WebPlaybackCallbacks,
  autoplay = false
): () => void {
  let hls: Hls | undefined;
  let ts: mpegts.Player | undefined;
  let disposed = false;
  let retries = 0;
  const onError = () => callbacks.failure(`Video error ${video.error?.code || 'unknown'} — source, codec or network may be incompatible.`);
  const onPlaying = () => callbacks.ready?.();
  video.addEventListener('error', onError);
  video.addEventListener('playing', onPlaying);
  const start = () => {
    if (!autoplay || disposed) return;
    video.play().catch(() => callbacks.status('Ready — press Play to start.'));
  };
  const cleanup = () => {
    disposed = true;
    video.removeEventListener('error', onError);
    video.removeEventListener('playing', onPlaying);
    hls?.destroy();
    if (ts) {
      try { ts.pause(); ts.unload(); ts.detachMediaElement(); ts.destroy(); } catch { /* disposed */ }
    }
    video.pause();
    video.removeAttribute('src');
    video.load();
  };
  try {
    callbacks.status('Opening stream…');
    if (kind === 'hls') {
      // Native HLS on Safari/WebKit first; hls.js MSE for Chrome desktop.
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.addEventListener('loadedmetadata', start, { once: true });
      } else if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: true, lowLatencyMode: false, backBufferLength: 45 });
        hls.on(Hls.Events.MEDIA_ATTACHED, () => hls?.loadSource(url));
        hls.on(Hls.Events.MANIFEST_PARSED, start);
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal || disposed) return;
          if (retries++ < 2 && data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            callbacks.status('Network issue — retrying stream…');
            hls?.startLoad();
          } else if (retries < 3 && data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            callbacks.status('Decoder issue — attempting recovery…');
            hls?.recoverMediaError();
          } else {
            callbacks.failure(`HLS ${data.details || 'playback error'}. Check CORS, HTTPS, codec and provider access.`);
          }
        });
        hls.attachMedia(video);
      } else {
        callbacks.failure('This browser cannot decode HLS.');
      }
    } else if (kind === 'mpegts') {
      if (!mpegts.isSupported()) {
        callbacks.failure('MPEG-TS needs a compatible HLS rendition on this device.');
      } else {
        ts = mpegts.createPlayer({ type: 'mpegts', isLive: true, url }, { enableWorker: true, lazyLoad: false });
        ts.on(mpegts.Events.ERROR, (_type, detail) => callbacks.failure(`MPEG-TS: ${detail}. Try an HLS feed.`));
        ts.attachMediaElement(video);
        ts.load();
        start();
      }
    } else {
      video.src = url;
      video.addEventListener('loadedmetadata', start, { once: true });
    }
  } catch (err) {
    callbacks.failure(err instanceof Error ? err.message : 'Unable to initialize the player.');
  }
  return cleanup;
}
