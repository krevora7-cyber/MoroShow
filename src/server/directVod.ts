type VodTitle = {
  type: 'movie' | 'tv';
  id: number;
  season?: number;
  episode?: number;
  name: string;
  originalName?: string;
  year?: string;
};

type DirectVod = { streamUrl: string; streamType: 'mp4' | 'hls' };

export const DIRECT_VOD_IDS = ['moviebox', 'cinepro', 'icefy'] as const;
export type DirectVodId = typeof DIRECT_VOD_IDS[number];

const labels: Record<DirectVodId, string> = {
  moviebox: 'MovieBox',
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
    moviebox: process.env.MOROSHOW_MOVIEBOX_URL,
    cinepro: process.env.MOROSHOW_CINEPRO_URL,
    icefy: process.env.MOROSHOW_ICEFY_URL,
  };
  return DIRECT_VOD_IDS.flatMap(id => {
    const url = secureUrl(urls[id]);
    const secret = id === 'moviebox' ? process.env.MOROSHOW_MOVIEBOX_SECRET?.trim() : undefined;
    if (!url || (id === 'moviebox' && !secret)) return [];
    return [{ id, label: labels[id], base: url, secret }];
  });
}

type Provider = ReturnType<typeof directVodOptions>[number];

async function json(provider: Provider, path: string, signal: AbortSignal, body?: object, query?: URLSearchParams) {
  const url = new URL(provider.base);
  url.pathname = url.pathname.replace(/\/+$/, '') + path;
  url.search = query?.toString() ?? '';
  url.hash = '';
  const headers = new Headers({ Accept: 'application/json' });
  if (provider.secret) headers.set('X-Worker-Secret', provider.secret);
  if (body) headers.set('Content-Type', 'application/json');
  const response = await fetch(url, {
    headers, signal, redirect: 'error',
    ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
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

function titleKey(value: string) {
  return value.normalize('NFKC').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

async function fromMovieBox(provider: Provider, title: VodTitle, signal: AbortSignal) {
  const { items } = await json(provider, '/search', signal, { keyword: title.name });
  const names = new Set([title.name, title.originalName ?? title.name].map(titleKey));
  const matches = Array.isArray(items) && title.year ? items.filter(item =>
    item?.type === title.type && typeof item.title === 'string' && names.has(titleKey(item.title)) &&
    typeof item.releaseDate === 'string' && item.releaseDate.slice(0, 4) === title.year &&
    typeof item.subjectId === 'string' && /^\d+$/.test(item.subjectId)
  ) : [];
  const ids = [...new Set(matches.map(item => item.subjectId as string))];
  if (ids.length !== 1) return;
  const query = new URLSearchParams({ se: String(title.season ?? 0), ep: String(title.episode ?? 0) });
  const { streams } = await json(provider, `/stream/${ids[0]}`, signal, undefined, query);
  if (!Array.isArray(streams)) return;
  for (const stream of [...streams].sort((a, b) => movieBoxRank(b) - movieBoxRank(a))) {
    const candidate = asStream(stream?.url, stream?.format);
    if (candidate?.streamType === 'mp4') return candidate;
  }
}

function movieBoxRank(stream: { codecName?: string; resolution?: number } | null) {
  const resolution = Number(stream?.resolution) || 0;
  const avc = /^(h264|avc)/i.test(stream?.codecName ?? '');
  return (avc ? 10000 : 0) - Math.abs(resolution - 720);
}

export async function resolveDirectVod(provider: Provider, title: VodTitle): Promise<DirectVod | undefined> {
  const signal = AbortSignal.timeout(12000);
  try {
    if (provider.id === 'moviebox') return await fromMovieBox(provider, title, signal);
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
