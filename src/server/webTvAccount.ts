import { createHash } from 'node:crypto';
import { safeUrl, upstream, type OriginPolicy } from './geilTv';
import type { Feed, PublicChannel } from './publicTvCatalog';

type Account = { base: URL; username: string; password: string; policy: OriginPolicy };
type RequestRows = (url: URL) => Promise<unknown>;
const key = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 24);

const QUALITY = /(?:[\s–_-]+|(?=\())(?:\(\s*(4K|UHD|FHD|HD|SD|HEVC|H\.?26[45]|(?:2160|1080|720|576|540|480|360|240)P?)\s*\)|(4K|UHD|FHD|HD|SD|HEVC|H\.?26[45]|(?:2160|1080|720|576|540|480|360|240)P?))$/i;
const QUALITY_ORDER = ['4K', 'UHD', '2160p', 'FHD', '1080p', 'HD', '720p', '576p', '540p', '480p', 'SD', '360p', '240p', 'H264', 'HEVC'];

function channelVariant(name: string) {
  let title = name.normalize('NFKC').replace(/\s+/g, ' ').trim();
  const qualifiers: string[] = [];
  let quality = '';
  // Keep language and event qualifiers in the identity, even after a quality suffix.
  while (title) {
    const qualifier = title.match(/\s+(\((?:EVENT ONLY|BACKUP\s*\d*)\)|EN|FR|AR|ES|TR)$/i);
    if (qualifier) {
      qualifiers.unshift(qualifier[1]);
      title = title.slice(0, qualifier.index).trim();
      continue;
    }
    const match = title.match(QUALITY);
    if (!match || match.index === 0) break;
    const token = (match[1] || match[2]).toUpperCase().replace('.', '');
    const label = /^\d/.test(token) && token !== '4K' ? token.replace(/P?$/, 'p') : token === 'H265' ? 'HEVC' : token;
    quality = quality ? `${label} ${quality}` : label;
    title = title.slice(0, match.index).trim();
  }
  const display = [title, ...qualifiers].join(' ');
  const identity = display.toLowerCase()
    .replace(/\bbein sports\b/g, 'bein sport')
    .replace(/\b(max|xtra)\s*(?=\d)/g, '$1 ')
    .replace(/\b0+(?=\d)/g, '');
  return { display, identity, quality };
}

function orderQuality(feed: Feed) {
  const rank = QUALITY_ORDER.indexOf(feed.label?.split(' ')[0] || '');
  return rank === -1 ? QUALITY_ORDER.length : rank;
}

function configuredAccount(raw: string): Account {
  const { base, username, password, mediaOrigins = [] } = JSON.parse(raw);
  const address = safeUrl(base);
  if (typeof username !== 'string' || !username || typeof password !== 'string' || !password ||
      address.search || address.hash || address.pathname !== '/') throw new Error('Invalid IPTV configuration');
    if (!Array.isArray(mediaOrigins) || mediaOrigins.length > 15) throw new Error('Invalid IPTV media origins');
  const origins = new Set<string>(mediaOrigins.map((value: string) => {
    const url = safeUrl(value);
    if (url.search || url.hash || url.pathname !== '/') throw new Error('Invalid IPTV media origin');
    return url.origin;
  }));
  return { base: address, username, password, policy: { origin: address.origin, mediaOrigins: origins } };
}

async function requestRows(url: URL): Promise<unknown> {
  // Catalog requests contain account credentials and must never follow redirects.
  const { response } = await upstream(url.href, AbortSignal.timeout(18000), undefined, 0, {origin:url.origin,redirects:false});
  try {
    if (response.statusCode !== 200) throw new Error('IPTV provider unavailable');
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of response) {
      size += chunk.length;
      if (size > 16_000_000) throw new Error('IPTV catalog too large');
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString().replace(/^\uFEFF/, ''));
  } finally {
    response.destroy();
  }
}

export function webTvAccount(raw: string, request: RequestRows = requestRows) {
  let policy: OriginPolicy | undefined;
  let snapshot = new Map<string, PublicChannel>();
  let aliases = new Map<string, PublicChannel>();
  let updated = 0;
  let pending: Promise<void> | undefined;

  const refresh = async () => {
    const { base, username, password, policy: nextPolicy } = configuredAccount(raw);
    const action = (name: string) => {
      const url = new URL('/player_api.php', base);
      url.search = new URLSearchParams({ username, password, action: name }).toString();
      return request(url);
    };
    const [categories, streams] = await Promise.all([action('get_live_categories'), action('get_live_streams')]);
    if (!Array.isArray(categories) || !Array.isArray(streams)) throw new Error('IPTV catalog unavailable');
    const labels = new Map(categories.map(row => [String(row?.category_id), String(row?.category_name ?? '')]));
    const next = new Map<string, PublicChannel>();
    const grouped = new Map<string, PublicChannel>();
    const seen = new Set<string>();
    for (const row of streams) {
      const stream = String(row?.stream_id ?? '');
      const name = String(row?.name ?? '').trim();
      const category = labels.get(String(row?.category_id)) || 'Live TV';
      if (!/^\d{1,16}$/.test(stream) || !name || /\b(?:adult|xxx|porn)\b|18\+/i.test(name + ' ' + category)) continue;
      const id = 'xtream:' + key(base.origin + '/' + stream);
      if (seen.has(id)) continue;
      seen.add(id);
      const path = ['live', username, password, stream + '.m3u8'].map(encodeURIComponent).join('/');
      const { display, identity, quality } = channelVariant(name);
      const groupKey = JSON.stringify([String(row?.category_id ?? ''), identity]);
      const feed = {id: key(id), provider: 'xtream-web', url: new URL('/' + path, base).href, label: quality || undefined};
      const channel = grouped.get(groupKey);
      if (channel) {
        channel.sources.push(feed);
        channel.variantIds!.push(id);
        channel.variantNames!.push(name);
      } else {
        grouped.set(groupKey, { id, name: display, category, language: '', country: '', tvgId: '',
          sources: [feed], variantIds: [id], variantNames: [name] });
      }
    }
    const nextAliases = new Map<string, PublicChannel>();
    for (const channel of grouped.values()) {
      channel.sources.sort((a, b) => orderQuality(a) - orderQuality(b));
      if (channel.sources.length > 1) {
        channel.variantIds!.sort();
        channel.id = channel.variantIds![0];
        for (const id of channel.variantIds!) if (id !== channel.id) nextAliases.set(id, channel);
        channel.variantIds = channel.variantIds!.slice(1);
      } else {
        channel.variantIds = undefined;
      }
      next.set(channel.id, channel);
    }
    if (!next.size) throw new Error('IPTV catalog has no live channels');
    snapshot = next;
    aliases = nextAliases;
    policy = nextPolicy;
    updated = Date.now();
  };

  async function catalog() {
    if (!raw) throw new Error('The IPTV account has not been configured.');
    if (!pending && Date.now() - updated > 180000) {
      pending = refresh().catch(() => {
        updated = Date.now() - 165000;
      }).finally(() => { pending = undefined; });
    }
    if (!snapshot.size) await pending;
    if (!snapshot.size) throw new Error('The IPTV channel list is unavailable. Please retry.');
    return snapshot;
  }

  return { catalog, channel: (id: string) => snapshot.get(id) ?? aliases.get(id), mediaPolicy: () => policy };
}
