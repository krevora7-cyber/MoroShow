type VodTitle = {
  type: 'movie' | 'tv';
  id: number;
  season?: number;
  episode?: number;
};

type DirectVod = { streamUrl: string; streamType: 'mp4' | 'hls' };

export const DIRECT_VOD_IDS = ['cinepro', 'icefy'] as const;
export type DirectVodId = typeof DIRECT_VOD_IDS[number];

const labels: Record<DirectVodId, string> = {
  cinepro: 'CinePro',
  icefy: 'Icefy',
};

function secureUrl(value: unknown): URL | undefined {
  if (typeof value !== 'string' || !value.trim()) return;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url;
  } catch {}
}

export function directVodOptions() {
  const urls = {
    cinepro: process.env.MOROSHOW_CINEPRO_URL,
    icefy: process.env.MOROSHOW_ICEFY_URL,
  };
  return DIRECT_VOD_IDS.flatMap(id => {
    const url = secureUrl(urls[id]);
    return url ? [{ id, label: labels[id], base: url }] : [];
  });
}

type Provider = ReturnType<typeof directVodOptions>[number];

async function json(provider: Provider, path: string, signal: AbortSignal) {
  const url = new URL(provider.base);
  url.pathname = url.pathname.replace(/\/+$/, '') + path;
  url.search = '';
  url.hash = '';
  const response = await fetch(url, {
    headers: { Accept: 'application/json' }, signal, redirect: 'error',
  });
  if (!response.ok) throw new Error('Provider request failed.');
  return response.json();
}

function asStream(urlValue: unknown, streamType: unknown): DirectVod | undefined {
  const url = secureUrl(urlValue);
  if (!url || (streamType !== 'mp4' && streamType !== 'hls')) return;
  if (/\.(mkv|webm|mpd|html?)$/i.test(url.pathname)) return;
  return { streamUrl: url.href, streamType };
}

export async function resolveDirectVod(provider: Provider, title: VodTitle): Promise<DirectVod | undefined> {
  const signal = AbortSignal.timeout(12000);
  try {
    if (provider.id === 'icefy') {
      const episode = title.type === 'tv' ? `/${title.season}/${title.episode}` : '';
      const data = await json(provider, `/${title.type}/${title.id}${episode}`, signal);
      return asStream(data?.stream, 'hls');
    }
    const path = title.type === 'tv'
      ? `/v1/tv/${title.id}/seasons/${title.season}/episodes/${title.episode}`
      : `/v1/movies/${title.id}`;
    const data = await json(provider, path, signal);
    if (!Array.isArray(data?.sources)) return;
    for (const source of data.sources) {
      const candidate = asStream(source?.url, source?.type);
      if (candidate) return candidate;
    }
  } catch {
    // The caller keeps the current player available when a provider fails.
  }
}
