/**
 * Server-only Xtream-compatible catalog adapter.
 * The end-user app never receives source credentials or raw playback URLs.
 * Supports an authorized provider exposing player_api.php.
 */
import { generateContentId } from '../utils/fnv1a64';
import { isContentKidFriendly, detectStreamType, type PlaylistItem } from '../utils/m3uParser';
import { consolidationKey } from '../utils/groupCatalog';
import { fnv1a64 } from '../utils/fnv1a64';

export interface XtreamConfig {
  api: URL;
  base: string;
  username: string;
  password: string;
}

export function configFromM3u(raw: string): XtreamConfig | null {
  const u = new URL(raw);
  if (!/\/get\.php$/i.test(u.pathname)) return null;
  const username = u.searchParams.get('username');
  const password = u.searchParams.get('password');
  if (!username || !password) throw new Error('The provider account is missing username/password settings.');
  const api = new URL(u.toString());
  api.pathname = api.pathname.replace(/get\.php$/i, 'player_api.php');
  api.searchParams.delete('type');
  api.searchParams.delete('output');
  // Retain the original server path prefix, not just origin.
  const base = new URL('.', api).href.replace(/\/$/, '');
  return { api, base, username, password };
}

export function apiActionUrl(config: XtreamConfig, action: string, args: Record<string, string> = {}): URL {
  const u = new URL(config.api.toString());
  u.searchParams.set('action', action);
  for (const [k, v] of Object.entries(args)) u.searchParams.set(k, v);
  return u;
}

export async function xtreamGet(config: XtreamConfig, action: string, args: Record<string, string> = {}, request: typeof fetch = fetch, timeoutMs = 45000): Promise<any> {
  const url = apiActionUrl(config, action, args);
  let response: Response;
  try {
    response = await request(url.toString(), {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'Accept': 'application/json', 'User-Agent': 'NetShow/3.4.1' }
    });
  } catch (err: any) {
    // Never log provider URLs because they contain username/password.
    throw new Error(`Xtream ${action} network request failed (${err?.name || 'network error'})`);
  }
  if (!response.ok) throw new Error(`Xtream ${action} returned HTTP ${response.status}`);
  let raw: string;
  try {
    raw = await response.text();
  } catch (err: any) {
    throw new Error(`Xtream ${action} response download failed (${err?.name || 'read error'})`);
  }
  // UTF-8 BOM is common in some provider implementations.
  const body = raw.replace(/^\uFEFF/, '').trim();
  if (!body) throw new Error(`Xtream ${action} returned an empty response (HTTP ${response.status})`);
  let data: any;
  try {
    data = JSON.parse(body);
  } catch {
    const format = /^<!doctype html|^<html/i.test(body) ? 'HTML' :
      body.startsWith('{') || body.startsWith('[') ? 'malformed/truncated JSON' : 'non-JSON text';
    throw new Error(`Xtream ${action} returned ${format} (HTTP ${response.status}, ${raw.length} chars)`);
  }
  if (data && typeof data === 'object' && data.user_info?.auth === 0) throw new Error('Xtream credentials were rejected or expired');
  return data;
}

function validArray(value: unknown, action: string): any[] {
  if (!Array.isArray(value)) throw new Error(`Xtream ${action} returned an unexpected response, not a content array`);
  if (value.length > 250000) throw new Error(`Xtream ${action} catalog too large; pagination is required`);
  return value;
}
function str(x: unknown): string { return typeof x === 'string' ? x : x == null ? '' : String(x); }
function safeExt(x: unknown, fallback: string): string {
  const v = str(x).toLowerCase().replace(/^\./, '');
  return /^(mp4|mkv|ts|m3u8|webm)$/.test(v) ? v : fallback;
}
function playlistItem(data: {
  id: string | number; name: string; category: string; kind: PlaylistItem['kind'];
  url: string; logo?: string; tvgId?: string; seriesTitle?: string; season?: number; episode?: number;
}): PlaylistItem {
  return {
    id: generateContentId({streamUrl:data.url, name:data.name, tvgId:data.tvgId, groupTitle:data.category, season:data.season, episode:data.episode}),
    name: data.name, streamUrl:data.url, streamType:detectStreamType(data.url),kind:data.kind,
    category:data.category,logoUrl:data.logo || '',tvgId:data.tvgId,
    isKidFriendly:isContentKidFriendly(data.name,data.category),
    seriesTitle:data.seriesTitle,season:data.season,episode:data.episode
  };
}
function streamURL(config: XtreamConfig, family: 'live'|'movie'|'series', id: string | number, ext: string): string {
  return `${config.base}/${family}/${encodeURIComponent(config.username)}/${encodeURIComponent(config.password)}/${encodeURIComponent(String(id))}.${ext}`;
}

export interface SeriesReference { providerSeriesId: string; name: string; catalogId: string; category: string; logo: string; }
export interface XtreamCatalog { items: PlaylistItem[]; seriesRefs: Map<string,SeriesReference>; counts: { live: number; movies: number; series: number }; warnings: string[]; }

export function normalizeXtream(config: XtreamConfig, payload: {
  liveCategories: any[]; vodCategories: any[]; seriesCategories: any[];
  live: any[]; vod: any[]; series: any[];
  warnings?: string[];
}): XtreamCatalog {
  const categoryMap = (arr:any[])=>new Map(arr.map(x=>[str(x.category_id),str(x.category_name)||'General']));
  const liveCat=categoryMap(payload.liveCategories), vodCat=categoryMap(payload.vodCategories), seriesCat=categoryMap(payload.seriesCategories);
  const items:PlaylistItem[]=[];
  const refs = new Map<string,SeriesReference>();
  for (const s of payload.live) {
    if (s.stream_id == null || !str(s.name)) continue;
    const name=str(s.name).trim();
    const category=liveCat.get(str(s.category_id)) || 'Live TV';
    items.push(playlistItem({id:s.stream_id,name,category,kind:'live',logo:str(s.stream_icon),tvgId:str(s.epg_channel_id),url:streamURL(config,'live',s.stream_id,'ts')}));
  }
  for (const s of payload.vod) {
    if (s.stream_id == null || !str(s.name)) continue;
    const name=str(s.name).trim();
    const category=vodCat.get(str(s.category_id)) || 'Movies';
    const ext=safeExt(s.container_extension,'mp4');
    items.push(playlistItem({id:s.stream_id,name,category,kind:'movie',logo:str(s.movie_image || s.cover_big || s.stream_icon),url:streamURL(config,'movie',s.stream_id,ext)}));
  }
  for (const s of payload.series) {
    if (s.series_id == null || !str(s.name)) continue;
    const name=str(s.name).trim();
    const category=seriesCat.get(str(s.category_id)) || 'Series';
    // A series root is a catalog-only card. Episodes are loaded lazily on opening it.
    const root = playlistItem({id:s.series_id,name,category,kind:'series',logo:str(s.cover),url:''});
    root.seriesTitle=name;
    items.push(root);
    const catalogId=`ns-g-${fnv1a64(consolidationKey(root))}`;
    refs.set(catalogId,{providerSeriesId:str(s.series_id),name,catalogId,category,logo:str(s.cover)});
  }
  return {items,seriesRefs:refs,counts:{live:payload.live.length,movies:payload.vod.length,series:payload.series.length},warnings:payload.warnings || []};
}

/**
 * Some Xtream providers truncate/replace very large get_vod_streams responses
 * with an HTTP 200 HTML/text response. Try category-scoped requests and keep
 * working live/series catalogs available even if VOD remains unavailable.
 * Restrict concurrency to avoid overloading the provider.
 */
async function loadVodByCategories(config: XtreamConfig, vodCategories: any[], request: typeof fetch,
  warnings: string[]): Promise<any[]> {
  const ids = Array.from(new Set(vodCategories.map(c => str(c?.category_id)).filter(Boolean)));
  if (!ids.length) return [];
  const results: any[] = [];
  const seen = new Set<string>();
  let next = 0;
  let successful = 0;
  let failed = 0;
  const failures: string[] = [];

  async function fetchOne(id: string) {
    try {
      const value = validArray(await xtreamGet(config, 'get_vod_streams', { category_id: id }, request, 14000),
        'get_vod_streams (category)');
      successful++;
      for (const movie of value) {
        // Use the provider's identifier, not its title, to deduplicate.
        const key = str(movie?.stream_id);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        results.push(movie);
      }
    } catch (e: any) {
      failed++;
      if (failures.length < 2) failures.push(String(e?.message || 'invalid response'));
    }
  }
  // Probe a handful of categories first. If the provider does not accept
  // category-scoped VOD queries, fail quickly instead of issuing 142 requests.
  const probeCount = Math.min(ids.length, 4);
  for (const id of ids.slice(0, probeCount)) await fetchOne(id);
  if (successful === 0) {
    warnings.push(`Movies unavailable: category fallback failed (${failures.join('; ')}).`);
    return [];
  }
  async function worker() {
    while (next < ids.length - probeCount) {
      const index = next++;
      await fetchOne(ids[probeCount + index]);
    }
  }
  await Promise.all(Array.from({length:Math.min(6,ids.length-probeCount)},()=>worker()));
  if (failed) warnings.push(`Movies: ${failed} of ${ids.length} category requests failed; showing available results.`);
  return results;
}


/** Retry the provider's category-scoped API if the full response was truncated.
 * Never replace real catalog data with fake/demo entries. */
async function loadStreamsByCategories(config: XtreamConfig, categories: any[], action: 'get_live_streams'|'get_series', request: typeof fetch, warnings: string[]): Promise<any[]> {
  const ids = [...new Set(categories.map(c => str(c?.category_id)).filter(Boolean))];
  if (!ids.length) return [];
  const results: any[] = [];
  const seen = new Set<string>();
  let successful = 0;
  let errors = 0;
  let cursor = 0;
  const idField = action === 'get_series' ? 'series_id' : 'stream_id';
  const prioritized = ids.sort((a,b) => {
    const findName = (id:string) => str(categories.find(c=>str(c.category_id)===id)?.category_name).toLowerCase();
    const score = (name:string) => /(bein|sport|news|cinema|kids|movie|series|france|morocco|maroc)/i.test(name)?1:0;
    return score(findName(b))-score(findName(a));
  });
  async function fetchOne(id:string) {
    try {
      const data = validArray(await xtreamGet(config,action,{category_id:id},request,14000), action+' (category)');
      successful++;
      for(const entry of data) {
        const key=str(entry?.[idField]);
        if (key && !seen.has(key)) { seen.add(key); results.push(entry); }
      }
    } catch { errors++; }
  }
  // Probe first: on providers ignoring category_id, do not issue hundreds of redundant requests.
  for (const id of prioritized.slice(0,Math.min(3,prioritized.length))) await fetchOne(id);
  if (!successful) { warnings.push(`${action}: category fallback unavailable`); return []; }
  const rest=prioritized.slice(Math.min(3,prioritized.length));
  async function worker() { while(cursor < rest.length) await fetchOne(rest[cursor++]); }
  await Promise.all(Array.from({length:Math.min(7,rest.length)},()=>worker()));
  if(errors) warnings.push(`${action}: ${errors} category requests failed; retained ${results.length} available entries`);
  return results;
}

export async function loadXtreamCatalog(config: XtreamConfig, request: typeof fetch=fetch, onPartial?: (data: XtreamCatalog)=>void):Promise<XtreamCatalog> {
  const warnings: string[] = [];
  async function optionalList(action:string):Promise<any[]> {
    try { return validArray(await xtreamGet(config,action,{},request),action); }
    catch (e:any) { warnings.push(`${action}: ${e?.message || 'unavailable'}`); return []; }
  }
  // Categories are often much smaller than stream lists and were confirmed
  // functional in the provider diagnostics.
  const [lc,vc,sc] = await Promise.all([
    optionalList('get_live_categories'),optionalList('get_vod_categories'),optionalList('get_series_categories')
  ]);

  const [liveResult, vodResult, seriesResult] = await Promise.allSettled([
    xtreamGet(config,'get_live_streams',{},request),
    xtreamGet(config,'get_vod_streams',{},request),
    xtreamGet(config,'get_series',{},request)
  ]);
  function settledList(result:PromiseSettledResult<any>,action:string):any[] {
    if(result.status==='fulfilled') {
      try { return validArray(result.value,action); }
      catch(e:any) { warnings.push(e.message); return []; }
    }
    warnings.push(`${action}: ${String(result.reason?.message || 'request failed')}`);
    return [];
  }
  let live = settledList(liveResult,'get_live_streams');
  let vod = settledList(vodResult,'get_vod_streams');
  let series = settledList(seriesResult,'get_series');
  // Publish the real entries already available while slow category fallbacks
  // continue. This prevents a giant movie catalog from blanking Live TV.
  const publish = () => {
    if (onPartial && (live.length || vod.length || series.length)) onPartial(normalizeXtream(config,{
      liveCategories:lc,vodCategories:vc,seriesCategories:sc,live,vod,series,warnings:[...warnings]
    }));
  };
  publish();
  if(liveResult.status==='rejected' || (live.length===0 && lc.length>0)) {
    live = await loadStreamsByCategories(config,lc,'get_live_streams',request,warnings);
    publish();
  }
  if(seriesResult.status==='rejected' || (series.length===0 && sc.length>0)) {
    series = await loadStreamsByCategories(config,sc,'get_series',request,warnings);
    publish();
  }
  if(vodResult.status==='rejected' || (vod.length===0 && vc.length>0)) {
    vod = await loadVodByCategories(config,vc,request,warnings);
    publish();
  }
  if(!live.length && !vod.length && !series.length) {
    throw new Error(`No usable Xtream content. ${warnings.slice(0,3).join(' | ')}`);
  }
  return normalizeXtream(config, {
    liveCategories:lc, vodCategories:vc, seriesCategories:sc,
    live, vod, series, warnings
  });
}

export function normalizeSeriesEpisodes(config:XtreamConfig, ref:SeriesReference, data:any):PlaylistItem[] {
  const eps=data?.episodes;
  if (!eps || typeof eps!=='object' || Array.isArray(eps)) return [];
  const items:PlaylistItem[]=[];
  for (const [seasonKey,entries] of Object.entries(eps)) {
    if (!Array.isArray(entries)) continue;
    const season = Number(seasonKey) || 1;
    for (const ep of entries) {
      if (ep?.id==null) continue;
      const episode=Number(ep.episode_num)||items.length+1;
      const name=`${ref.name} S${String(season).padStart(2,'0')}E${String(episode).padStart(2,'0')}`;
      items.push(playlistItem({id:ep.id,name,category:ref.category,kind:'series',seriesTitle:ref.name,
        season,episode,logo:str(ep?.info?.movie_image||ref.logo),url:streamURL(config,'series',ep.id,safeExt(ep.container_extension,'mp4'))}));
    }
  }
  return items;
}

export async function loadXtreamTV(config:XtreamConfig,request:typeof fetch=fetch):Promise<XtreamCatalog>{
 const warnings:string[]=[];
 const categories=validArray(await xtreamGet(config,'get_live_categories',{},request,20000),'get_live_categories');
 let live:any[]=[];
 try{live=validArray(await xtreamGet(config,'get_live_streams',{},request,25000),'get_live_streams');}
 catch{live=await loadStreamsByCategories(config,categories,'get_live_streams',request,warnings);}
 return normalizeXtream(config,{live,liveCategories:categories,vod:[],vodCategories:[],series:[],seriesCategories:[],warnings});
}
