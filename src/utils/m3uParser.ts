import { generateContentId } from './fnv1a64.ts';

export type ContentKind = 'live' | 'movie' | 'series';
export type StreamType = 'hls' | 'mpegts' | 'mp4';

export interface PlaylistItem {
  id: string;
  name: string;
  streamUrl: string;
  streamType: StreamType;
  kind: ContentKind;
  category: string;
  logoUrl?: string;
  tvgId?: string;
  audioLanguage?: string;
  epgName?: string;
  seriesTitle?: string;
  season?: number;
  episode?: number;
  isKidFriendly: boolean;
  description?: string;
  year?: number;
  rating?: string;
}

export interface ParsedPlaylist {
  items: PlaylistItem[];
  categories: string[];
  liveCount: number;
  movieCount: number;
  seriesCount: number;
}

const ATTR_REGEX = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
const SEASON_EPISODE_REGEX = /(?:S(\d{1,2})\s*E(\d{1,3}))|(?:Season\s*(\d{1,2})\s*Episode\s*(\d{1,3}))/i;
const YEAR_REGEX = /\b(19\d\d|20\d\d)\b/;

// Strictly for Kids under 13 years old (< 13 ans) and Cartoons / Animation
const KIDS_KEYWORDS = [
  'kid', 'kids', 'child', 'children', 'cartoon', 'cartoons', 'animation',
  'animated', 'disney', 'pixar', 'nickelodeon', 'nick jr', 'nicktoons',
  'junior', 'baby', 'toons', 'pbs kids', 'spacetoon', 'mbc3', 'mbc 3',
  'cn ', 'cartoon network', 'boomerang', 'cartoonito', 'gulli', 'tiji',
  'canal j', 'teletoon', 'baraem', 'majid', 'toyoor', 'karameesh',
  'peppa', 'paw patrol', 'sponge', 'tom and jerry', 'looney tunes',
  'dora', 'pokemon', 'minions', 'scooby', 'ben 10', 'enfant', 'enfants',
  'jeunesse', 'dessin', 'animé', 'سبيستون', 'كرتون', 'أطفال', 'اطفال',
  'رسوم', 'طيور الجنة', 'براعم', 'ماجد', 'كراميش'
];

const OVER_13_OR_MATURE_KEYWORDS = [
  'xxx', 'adult', '18+', '+18', '16+', '+16', '14+', '13+', 'pg-13', 'pg13',
  'tv-14', 'tv-ma', 'nsfw', 'erotic', 'porn', 'redlight', 'mature',
  'horror', 'رعب', 'thriller', 'crime', 'gore', 'violence', 'deadpool'
];

export function detectStreamType(url: string): StreamType {
  const cleanUrl = url.toLowerCase().split('?')[0];
  if (cleanUrl.endsWith('.m3u8')) return 'hls';
  if (cleanUrl.endsWith('.ts')) return 'mpegts';
  if (cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.mkv') || cleanUrl.endsWith('.webm')) return 'mp4';
  if (cleanUrl.includes('/live/') && cleanUrl.endsWith('.ts')) return 'mpegts';
  if (cleanUrl.includes('/series/') || cleanUrl.includes('/movie/')) {
    if (cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.mkv')) return 'mp4';
  }
  return 'hls';
}

export function isContentKidFriendly(name: string, category: string, rating?: string): boolean {
  const text = `${name} ${category} ${rating || ''}`.toLowerCase();
  for (const restricted of OVER_13_OR_MATURE_KEYWORDS) {
    if (text.includes(restricted)) return false;
  }
  for (const kidKey of KIDS_KEYWORDS) {
    if (text.includes(kidKey)) return true;
  }
  return false;
}

export function parseM3U(content: string): ParsedPlaylist {
  const lines = content.split(/\r?\n/);
  const items: PlaylistItem[] = [];
  const categoriesSet = new Set<string>();

  let currentAttributes: Record<string, string> = {};
  let currentRawName = '';
  let pendingExtInf = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      pendingExtInf = true;
      currentAttributes = {};

      const lastCommaIndex = line.lastIndexOf(',');
      let headerAttrs = '';
      if (lastCommaIndex !== -1) {
        headerAttrs = line.substring(0, lastCommaIndex);
        currentRawName = line.substring(lastCommaIndex + 1).trim();
      } else {
        headerAttrs = line;
        currentRawName = 'Untitled Channel';
      }

      let match;
      while ((match = ATTR_REGEX.exec(headerAttrs)) !== null) {
        currentAttributes[match[1].toLowerCase()] = match[2];
      }
    } else if (pendingExtInf && !line.startsWith('#')) {
      const streamUrl = line;
      pendingExtInf = false;

      const tvgId = currentAttributes['tvg-id'] || '';
      const audioLanguage = currentAttributes['tvg-language'] || currentAttributes['audio-language'] || currentAttributes['language'] || '';
      const tvgName = currentAttributes['tvg-name'] || '';
      const logoUrl = currentAttributes['tvg-logo'] || '';
      const groupTitle = currentAttributes['group-title'] || 'General';

      const finalName = currentRawName || tvgName || 'Untitled Stream';
      const streamType = detectStreamType(streamUrl);

      const seMatch = finalName.match(SEASON_EPISODE_REGEX);
      const lowerGroup = groupTitle.toLowerCase();
      let kind: ContentKind = 'live';
      let season: number | undefined;
      let episode: number | undefined;
      let seriesTitle: string | undefined;

      if (seMatch) {
        kind = 'series';
        season = parseInt(seMatch[1] || seMatch[3] || '1', 10);
        episode = parseInt(seMatch[2] || seMatch[4] || '1', 10);
        seriesTitle = finalName.slice(0, seMatch.index).trim().replace(/[-–:]$/, '').trim();
      } else if (
        lowerGroup.includes('movie') ||
        lowerGroup.includes('cinema') ||
        lowerGroup.includes('vod') ||
        lowerGroup.includes('films') ||
        streamUrl.includes('/movie/')
      ) {
        kind = 'movie';
      } else if (
        lowerGroup.includes('series') ||
        lowerGroup.includes('tv shows') ||
        streamUrl.includes('/series/')
      ) {
        kind = 'series';
      }

      const yearMatch = finalName.match(YEAR_REGEX);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;
      const kidFriendly = isContentKidFriendly(finalName, groupTitle);

      const id = generateContentId({
        streamUrl,
        name: finalName,
        tvgId,
        groupTitle,
        season,
        episode
      });

      categoriesSet.add(groupTitle);

      items.push({
        id,
        name: finalName,
        streamUrl,
        streamType,
        kind,
        category: groupTitle,
        logoUrl,
        tvgId,
        audioLanguage,
        epgName: tvgName,
        seriesTitle: seriesTitle || (kind === 'series' ? finalName : undefined),
        season,
        episode,
        isKidFriendly: kidFriendly,
        year
      });
    }
  }

  let liveCount = 0;
  let movieCount = 0;
  let seriesCount = 0;

  for (const item of items) {
    if (item.kind === 'live') liveCount++;
    else if (item.kind === 'movie') movieCount++;
    else if (item.kind === 'series') seriesCount++;
  }

  return {
    items,
    categories: Array.from(categoriesSet).sort(),
    liveCount,
    movieCount,
    seriesCount
  };
}
