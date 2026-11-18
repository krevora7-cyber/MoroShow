type Subtitle = { url: string; lang: string; label: string };

function httpsUrl(value: unknown) {
  if (typeof value !== 'string') return;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url;
  } catch { /* Unsupported URL */ }
}

export function configuredVodAddon(provider: string) {
  const value = provider === 'vixsrc' ? process.env.MOROSHOW_VIXSRC_ADDON :
    provider === 'vidlink' ? process.env.MOROSHOW_VIDLINK_ADDON : undefined;
  const manifest = httpsUrl(value);
  if (manifest?.pathname.endsWith('/manifest.json') && !manifest.search && !manifest.hash) return manifest;
}

function subtitlesFor(value: unknown): Subtitle[] {
  if (!Array.isArray(value)) return [];
  const tracks: Subtitle[] = [];
  for (const track of value) {
    const url = httpsUrl(track?.url);
    if (!url || !/\.vtt$/i.test(url.pathname) || !/^([a-z]{2,3})(-[a-z0-9]{2,8})*$/i.test(String(track.lang ?? '')) || tracks.some(t => t.url === url.href)) continue;
    tracks.push({url: url.href, lang: track.lang, label: track.lang});
  }
  return tracks;
}

// Use the standard Stremio HTTP stream resource. Only the server chooses the addon origin.
export async function addonVod(manifest: URL, imdb: string, season?: number, episode?: number) {
  if (!/^tt\d+$/.test(imdb)) return;
  const series = season !== undefined && episode !== undefined;
  const key = series ? imdb + ':' + season + ':' + episode : imdb;
  const resource = new URL('stream/' + (series ? 'series' : 'movie') + '/' + key + '.json', manifest);
  const response = await fetch(resource, {headers:{Accept:'application/json'}, redirect:'error', signal:AbortSignal.timeout(6000)});
  if (!response.ok) return;
  const data = await response.json();
  return directAddonStream(data?.streams);
}

export function directAddonStream(streams: unknown) {
  if (!Array.isArray(streams)) return;
  for (const stream of streams.slice(0,100)) {
    const url = httpsUrl(stream?.url);
    if (!url || stream.behaviorHints?.proxyHeaders || (stream.headers && Object.keys(stream.headers).length)) continue;
    const streamType = /\.m3u8$/i.test(url.pathname) ? 'hls' : /\.mp4$/i.test(url.pathname) ? 'mp4' : undefined;
    if (streamType) return {streamUrl:url.href, streamType, subtitles:subtitlesFor(stream.subtitles)};
  }
}
