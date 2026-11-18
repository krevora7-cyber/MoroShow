const progressOrigins = new Set(['https://vidlink.pro', 'https://player.cinezo.live', 'https://vixsrc.to']);

export function readEmbedProgress(origin: string, data: any, expectedOrigin: string, contentId: string) {
  if (origin !== expectedOrigin || !progressOrigins.has(origin)) return null;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { return null; }
  }
  const title = /^w32:(movie|tv):(\d+)(?::(\d+):(\d+))?$/.exec(contentId);
  const event = data?.data;
  if (!title || data?.type !== 'PLAYER_EVENT' || !event) return null;
  if (origin === 'https://vixsrc.to') {
    // VixSrc reports its own video_id. The caller pins this to the actual iframe session.
    if (!Number.isSafeInteger(event.video_id) || event.video_id < 1) return null;
  } else {
    if (Number(event.tmdbId ?? event.mtmdbId) !== Number(title[2]) || event.mediaType !== title[1]) return null;
    if (title[1] === 'tv' && (Number(event.season) !== Number(title[3]) || Number(event.episode) !== Number(title[4]))) return null;
  }
  const {currentTime, duration} = event;
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || currentTime < 0 || duration <= 0 || duration > 86400 || currentTime > duration + 5) return null;
  return {
    time: Math.min(currentTime, duration), duration, event: String(event.event || 'timeupdate'),
    videoId: origin === 'https://vixsrc.to' ? event.video_id as number : undefined,
  };
}
