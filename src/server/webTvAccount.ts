import { createHash } from 'node:crypto';
import { safeUrl, upstream, type OriginPolicy } from './geilTv';
import type { PublicChannel } from './publicTvCatalog';

type Account = { base: URL; username: string; password: string; policy: OriginPolicy };
type RequestRows = (url: URL) => Promise<unknown>;
const key = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 24);

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
    for (const row of streams) {
      const stream = String(row?.stream_id ?? '');
      const name = String(row?.name ?? '').trim();
      const category = labels.get(String(row?.category_id)) || 'Live TV';
      if (!/^\d{1,16}$/.test(stream) || !name || /\b(?:adult|xxx|porn)\b|18\+/i.test(name + ' ' + category)) continue;
      const id = 'xtream:' + key(base.origin + '/' + stream);
      const path = ['live', username, password, stream + '.m3u8'].map(encodeURIComponent).join('/');
      next.set(id, {
        id, name, category, language: '', country: '', tvgId: '',
        sources: [{id: key(id), provider: 'xtream-web', url: new URL('/' + path, base).href}],
      });
    }
    if (!next.size) throw new Error('IPTV catalog has no live channels');
    snapshot = next;
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

  return { catalog, mediaPolicy: () => policy };
}
