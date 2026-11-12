import {useEffect, useRef, useState, type RefObject} from 'react';
import Hls from 'hls.js';

type Props = {
  url: string;
  type: 'hls' | 'mp4';
  title: string;
  startAt: number;
  videoRef: RefObject<HTMLVideoElement | null>;
  onProgress: (currentTime: number, duration: number) => void;
};

export function ProtectedEmbeddedPlayer({url, type, title, startAt, videoRef, onProgress}: Props) {
  const [error, setError] = useState('');
  const resume = useRef(startAt);
  const progress = useRef(onProgress);
  progress.current = onProgress;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let hls: Hls | undefined;
    let lastSavedAt = 0;
    let ready = false;
    const failed = () => setError('This source could not be played. Try another source or reload.');
    const loaded = () => {
      const position = resume.current;
      if (position > 0 && (!Number.isFinite(video.duration) || position < video.duration)) {
        video.currentTime = position;
      }
      ready = true;
    };
    const save = () => {
      if (!ready || !Number.isFinite(video.duration) || video.duration <= 0 || video.currentTime <= 0) return;
      lastSavedAt = Date.now();
      progress.current(Math.min(video.currentTime, video.duration), video.duration);
    };
    const timeUpdate = () => {
      if (Date.now() - lastSavedAt >= 5000) save();
    };

    video.addEventListener('loadedmetadata', loaded);
    video.addEventListener('timeupdate', timeUpdate);
    video.addEventListener('pause', save);
    video.addEventListener('seeked', save);
    video.addEventListener('ended', save);
    video.addEventListener('error', failed);

    if (type === 'mp4' || video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
    } else if (Hls.isSupported()) {
      hls = new Hls({maxBufferLength: 20, backBufferLength: 30});
      hls.on(Hls.Events.ERROR, (_, event) => {
        if (event.fatal) failed();
      });
      hls.attachMedia(video);
      hls.loadSource(url);
    } else {
      setError('HLS playback is unavailable on this device.');
    }

    return () => {
      save();
      video.removeEventListener('loadedmetadata', loaded);
      video.removeEventListener('timeupdate', timeUpdate);
      video.removeEventListener('pause', save);
      video.removeEventListener('seeked', save);
      video.removeEventListener('ended', save);
      video.removeEventListener('error', failed);
      hls?.destroy();
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [type, url, videoRef]);

  return <>
    <video ref={videoRef} aria-label={title} autoPlay controls playsInline tabIndex={0} preload="metadata" />
    {error && <p role="alert" className="m-player-help">{error}</p>}
  </>;
}
