import { randomUUID } from 'node:crypto';
import type { Express, Request, Response } from 'express';
import type { CatalogItem } from '../types';
import { db } from './db';
import { translateShortsText } from './shortsTranslation';
import { normalizeSubtitle } from './dramaPlayback';

const apiOrigin = 'https://api.dramarouter.com/api/freereels/';
const prefix = '/api/shorts-router';
const bookPattern = '[a-zA-Z0-9_-]{1,100}';
const bookIdPattern = new RegExp('^' + bookPattern + '$');
const seriesPattern = new RegExp('^drama:freereels-(' + bookPattern + ')(?::([1-9]\\d{0,3}))?$');
const labels = new Intl.DisplayNames(['en'], {type: 'language'});

type Book = {key?: string; id?: string; title?: string; name?: string; desc?: string; cover?: string};
type Episode = {index: number; unlock: boolean};
type Series = Book & {episode_list: Episode[]};
type Playback = {
  series_id: string; episode: number;
  sources?: {quality: string; format: string; proxy_url?: string}[];
  subtitles?: {language: string; proxy_url?: string}[];
};

function httpsUrl(value?: string) {
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url;
  } catch { return; }
}

function proxyUrl(value?: string) {
  const url = httpsUrl(value);
  return url?.origin === 'https://cdn.dramarouter.com' ? url.href : undefined;
}

function toItem(book: Book, id: string): CatalogItem {
  const name = book.title || book.name || 'Short drama';
  const image = httpsUrl(book.cover)?.href;
  return {id: 'drama:freereels-' + id, name, seriesTitle: name, kind: 'series',
    category: 'Shorts', isKidFriendly: false, logoUrl: image, backdropUrl: image,
    overview: book.desc || '', streamType: 'hls', streamUrl: ''};
}

async function localizeItems(items: CatalogItem[], lang: 'en' | 'ar') {
  const values = await translateShortsText(items.flatMap(item => [item.name, item.overview || '']), lang);
  return items.map((item, index) => ({...item, name: values[index * 2],
    seriesTitle: values[index * 2], overview: values[index * 2 + 1]}));
}

const searchTerm = (value: string) => value.trim().replace(/[’‘]/g, "'")
  .replace(/[^\p{L}\p{M}\p{N} '\-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);

export function registerFreeReels(app: Express, key = process.env.DRAMAROUTER_API_KEY) {
  const details = new Map<string, {until: number; value: Promise<Series>}>();
  const captions = new Map<string, {url: string; until: number}>();

  async function api<T>(path: string, params: Record<string, string>): Promise<T> {
    if (!key) throw new Error('The FreeReels trial has not been configured.');
    const url = new URL(path, apiOrigin);
    url.search = new URLSearchParams(params).toString();
    const response = await fetch(url, {
      headers: {Authorization: 'Bearer ' + key, Accept: 'application/json'},
      redirect: 'error', signal: AbortSignal.timeout(16000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 429) throw new Error('The DramaRouter request limit has been reached.');
      throw new Error('FreeReels is temporarily unavailable.');
    }
    return response.json();
  }

  function detail(id: string) {
    const cached = details.get(id);
    if (cached && cached.until > Date.now()) return cached.value;
    const value = api<{data?: {info?: Series}}>('detail', {id}).then(result => {
      const info = result.data?.info;
      if (!info || !Array.isArray(info.episode_list)) throw new Error('This series is unavailable.');
      return info;
    }).catch(error => {
      if (details.get(id)?.value === value) details.delete(id);
      throw error;
    });
    if (details.size >= 150) details.delete(details.keys().next().value!);
    details.set(id, {value, until: Date.now() + 180000});
    return value;
  }

  function errorResponse(res: Response, error: unknown) {
    const message = error instanceof Error && /^(?:The FreeReels trial|The DramaRouter request limit|FreeReels is|This series is)/.test(error.message)
      ? error.message : 'FreeReels is temporarily unavailable. Try again.';
    res.status(502).json({success: false, error: message});
  }

  app.get(prefix + '/caption/:id', async (req, res) => {
    const caption = captions.get(req.params.id);
    if (!caption || caption.until < Date.now()) return res.sendStatus(404);
    try {
      const response = await fetch(caption.url, {redirect: 'error', signal: AbortSignal.timeout(10000)});
      if (!response.ok) return res.sendStatus(502);
      const declared = Number(response.headers.get('content-length') || '0');
      if (declared > 2_000_000) return res.sendStatus(502);
      const reader = response.body?.getReader();
      if (!reader) return res.sendStatus(502);
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          length += chunk.value.byteLength;
          if (length > 2_000_000) return res.sendStatus(502);
          chunks.push(chunk.value);
        }
      } finally {
        await reader.cancel();
      }
      return res.type('text/vtt').send(normalizeSubtitle(Buffer.concat(chunks).toString('utf8')));
    } catch {
      return res.sendStatus(502);
    }
  });

  app.use(prefix, (req: Request, res: Response, next) => {
    const profile = db.getProfileById(String(req.query.profileId || req.body?.profileId || ''));
    if (!profile) return res.status(401).json({success: false, error: 'Select a profile first.'});
    if (profile.isKid) return res.status(403).json({success: false, error: 'Shorts are unavailable in Kids profiles.'});
    next();
  });

  app.get(prefix + '/catalog', async (req, res) => {
    try {
      const lang = req.query.lang === 'ar' ? 'ar' : 'en';
      const originalQuery = searchTerm(String(req.query.q || ''));
      const cursor = String(req.query.cursor || '');
      if (req.query.q && !originalQuery) return res.json({success: true, items: [], hasMore: false});
      if (cursor && !/^offset=\d{1,8}$/.test(cursor)) return res.status(400).json({success: false, error: 'Invalid catalogue page.'});
      const [translatedQuery] = await translateShortsText([originalQuery], 'en');
      const q = searchTerm(translatedQuery);
      if (/\p{Script=Arabic}/u.test(q)) {
        return res.status(502).json({success: false, error: 'ترجمة البحث غير متاحة مؤقتاً. جرّب كتابة العنوان بالإنجليزية.'});
      }
      if (q && q.length < 3) return res.json({success: true, items: [], hasMore: false});
      const params: Record<string, string> = {lang: 'en'};
      if (q) params.q = q;
      else if (cursor) params.next = cursor;
      const result = await api<{data?: {items?: Book[]; page_info?: {next?: string; has_more?: boolean}}}>(q ? 'search' : 'for_you', params);
      const items = (result.data?.items || []).flatMap(book => {
        const id = book.key ?? book.id;
        return id && bookIdPattern.test(id) ? [toItem(book, id)] : [];
      });
      const nextCursor = !q && result.data?.page_info?.has_more ? result.data.page_info.next : undefined;
      const localized = await localizeItems(items, lang);
      const note = lang === 'ar' && localized.some(item => !/\p{Script=Arabic}/u.test(item.name))
        ? 'بعض العناوين معروضة بلغتها الأصلية لأن الترجمة غير متاحة مؤقتاً.' : undefined;
      return res.json({success: true, items: localized, nextCursor, hasMore: !!nextCursor, note});
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  app.get(prefix + '/series/:id', async (req, res) => {
    const identity = seriesPattern.exec(req.params.id);
    if (!identity || identity[2]) return res.status(404).json({success: false, error: 'Series unavailable.'});
    try {
      const info = await detail(identity[1]);
      const lang = req.query.lang === 'ar' ? 'ar' : 'en';
      const [item] = await localizeItems([toItem(info, identity[1])], lang);
      const episodes = info.episode_list.flatMap((episode, index) => episode.unlock === true ? [{
        ...item, id: item.id + ':' + (index + 1), name: (lang === 'ar' ? 'الحلقة ' : 'Episode ') + (index + 1), season: 1, episode: index + 1,
      }] : []);
      return res.json({success: true, item, episodes, seasons: [1], season: 1,
        posterUrl: item.logoUrl, backdropUrl: item.backdropUrl, overview: item.overview});
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  app.post(prefix + '/play', async (req, res) => {
    const identity = seriesPattern.exec(String(req.body?.contentId || ''));
    if (!identity?.[2]) return res.status(400).json({success: false, error: 'Select an episode.'});
    try {
      const [, id, serial] = identity;
      const info = await detail(id);
      const episode = Number(serial);
      if (info.episode_list[episode - 1]?.unlock !== true) {
        return res.status(404).json({success: false, error: 'This episode is unavailable.'});
      }
      const playback = await api<Playback>('play', {id, eps: serial});
      const source = playback.sources?.find(entry => entry.quality === 'h264' && entry.format === 'hls');
      const streamUrl = proxyUrl(source?.proxy_url);
      if (String(playback.series_id) !== id || playback.episode !== episode || !streamUrl) {
        return res.status(502).json({success: false, error: 'FreeReels did not return a playable source for this episode.'});
      }
      const subtitles = (playback.subtitles || []).flatMap(track => {
        const url = proxyUrl(track.proxy_url);
        const lang = track.language;
        if (!url || !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(lang)) return [];
        const token = randomUUID();
        if (captions.size >= 3000) captions.delete(captions.keys().next().value!);
        captions.set(token, {url, until: Date.now() + 3600000});
        return [{url: prefix + '/caption/' + token, lang, label: labels.of(lang) || lang}];
      });
      const content = {...toItem(info, id), id: identity[0], name: 'Episode ' + serial, season: 1, episode};
      return res.json({success: true, token: randomUUID(), streamUrl, streamType: 'hls', variantId: 'shorts', content, subtitles});
    } catch (error) {
      return errorResponse(res, error);
    }
  });
}
