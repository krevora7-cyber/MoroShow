/**
 * NetShow Persistent Store & Data Engine
 * 
 * Manages Profiles, Watch History, Favorites, and Authorized IPTV Catalog.
 */

import { generateContentId } from '../utils/fnv1a64';
import fs from 'node:fs';
import path from 'node:path';
import { hashPin, generateSalt, verifyPinWithRateLimit } from '../utils/security';
import { parseM3U, PlaylistItem } from '../utils/m3uParser';
import { groupCatalog, consolidationKey, type PublicVariant } from '../utils/groupCatalog';

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  isKid: boolean;
  hasPin: boolean;
  pinSalt?: string;
  pinHash?: string;
  createdAt: number;
}

export interface WatchHistoryItem {
  contentId: string;
  name: string;
  streamUrl: string;
  streamType: 'hls' | 'mpegts' | 'mp4';
  kind: 'live' | 'movie' | 'series';
  category: string;
  posterUrl?: string;
  currentTime: number;
  duration: number;
  progressPercent: number;
  updatedAt: number;
}

export interface CatalogItem extends PlaylistItem {
  overview?: string;
  backdropUrl?: string;
  ratingBadge?: string;
  durationMinutes?: number;
  variants?: PublicVariant[];
}

// Built-in Curated Legal & Authorized IPTV Feeds
const DEFAULT_AUTHORIZED_M3U = `#EXTM3U
#EXTINF:-1 tvg-id="nasa.public" tvg-name="NASA TV Public HD" tvg-logo="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80" group-title="Science & Tech",NASA TV Public HD
https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8

#EXTINF:-1 tvg-id="nasa.media" tvg-name="NASA Space Station Live" tvg-logo="https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=400&q=80" group-title="Science & Tech",NASA Space Station Live
https://ntv2.akamaized.net/hls/live/2014077/NASA-NTV2-HLS/master.m3u8

#EXTINF:-1 tvg-id="bloomberg.us" tvg-name="Bloomberg Television" tvg-logo="https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&q=80" group-title="News & Finance",Bloomberg Television
https://liveprodupmxwb.akamaized.net/us/Channel-HD-AWS-virginia-1/master.m3u8

#EXTINF:-1 tvg-id="france24.en" tvg-name="France 24 International" tvg-logo="https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=400&q=80" group-title="News & Finance",France 24 International
https://static.france24.com/live/F24_EN_LO_HLS/live_tv.m3u8

#EXTINF:-1 tvg-id="dw.news" tvg-name="DW News English" tvg-logo="https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&q=80" group-title="News & Finance",DW News English
https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8

#EXTINF:-1 tvg-id="euronews.en" tvg-name="Euronews Live" tvg-logo="https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=400&q=80" group-title="News & Finance",Euronews Live
https://euronews-euronews-world-1-au.samsung.wurl.tv/playlist.m3u8

#EXTINF:-1 tvg-id="redbull.sports" tvg-name="Red Bull TV Sports" tvg-logo="https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=400&q=80" group-title="Sports & Action",Red Bull TV Sports
https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8

#EXTINF:-1 tvg-id="pbs.kids" tvg-name="PBS Kids Live" tvg-logo="https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&q=80" group-title="Kids & Family",PBS Kids Live
https://cdn-kids.pbskids.org/live/kids/kids-web/index.m3u8

#EXTINF:-1 tvg-id="toongoggles.kids" tvg-name="Toon Goggles Kids" tvg-logo="https://images.unsplash.com/photo-1563089145-599997674d42?w=400&q=80" group-title="Kids & Family",Toon Goggles Animated
https://toongoggles-klowdtv.amagi.tv/playlist.m3u8

#EXTINF:-1 group-title="Movies VOD",Big Buck Bunny 4K (2008)
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4

#EXTINF:-1 group-title="Movies VOD",Tears of Steel (2012)
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4

#EXTINF:-1 group-title="Movies VOD",Sintel Fantasy (2010)
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4

#EXTINF:-1 group-title="Movies VOD",Elephant's Dream (2006)
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4

#EXTINF:-1 group-title="TV Series",Deep Space Chronicles S01E01 - The Martian Descent
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4

#EXTINF:-1 group-title="TV Series",Deep Space Chronicles S01E02 - Orbital Odyssey
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4

#EXTINF:-1 group-title="TV Series",Deep Space Chronicles S01E03 - Return to Earth
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4

#EXTINF:-1 group-title="TV Series",Wild Horizons S01E01 - Secrets of the Coral Reef
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4

#EXTINF:-1 group-title="TV Series",Wild Horizons S01E02 - Alpine Peaks & Predators
https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4
`;

// Additional rich metadata dictionary for items
const ENRICHED_METADATA: Record<string, { overview: string; backdropUrl: string; ratingBadge: string; durationMinutes?: number }> = {
  'Big Buck Bunny 4K (2008)': {
    overview: 'A large, lovable rabbit awakens in the spring forest only to face mischief from three bullying rodents, leading to a comedic woodland showdown.',
    backdropUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=1280&q=80',
    ratingBadge: 'PG',
    durationMinutes: 10
  },
  'Tears of Steel (2012)': {
    overview: 'In a dystopian future Amsterdam, a squad of resistance fighters and scientists attempt to rewrite history using a robotic prosthetic device.',
    backdropUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1280&q=80',
    ratingBadge: 'PG-13',
    durationMinutes: 12
  },
  'Sintel Fantasy (2010)': {
    overview: 'A lonely young warrior girl befriends a wounded baby dragon, embarking on a treacherous quest across snowy mountain peaks when it is captured.',
    backdropUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1280&q=80',
    ratingBadge: 'PG',
    durationMinutes: 15
  },
  'Elephant\'s Dream (2006)': {
    overview: 'An elder guide leads a young apprentice through the strange, mechanistic clockwork innards of an infinite surreal machine.',
    backdropUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1280&q=80',
    ratingBadge: 'PG-13',
    durationMinutes: 11
  },
  'NASA TV Public HD': {
    overview: 'Live HD continuous coverage from the International Space Station, rocket launches, astronaut spacewalks, and deep space exploration.',
    backdropUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1280&q=80',
    ratingBadge: 'TV-G'
  },
  'NASA Space Station Live': {
    overview: 'Direct live high-definition earth viewing from the ISS external cameras traveling at 17,500 miles per hour.',
    backdropUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=1280&q=80',
    ratingBadge: 'TV-G'
  },
  'Bloomberg Television': {
    overview: 'Breaking global financial markets news, real-time economic data, central bank analysis, and leadership interviews.',
    backdropUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1280&q=80',
    ratingBadge: 'TV-PG'
  },
  'Red Bull TV Sports': {
    overview: 'Extreme sports, world-class downhill mountain biking, formula racing, cliff diving, and action documentary specials.',
    backdropUrl: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=1280&q=80',
    ratingBadge: 'TV-14'
  },
  'PBS Kids Live': {
    overview: 'Commercial-free, educational programming designed for young children and families, fostering curiosity and literacy.',
    backdropUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1280&q=80',
    ratingBadge: 'TV-Y'
  },
  'Toon Goggles Animated': {
    overview: 'Kid-safe cartoons, animated shorts, adventures, and family comedies curated specifically for children.',
    backdropUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=1280&q=80',
    ratingBadge: 'TV-Y7'
  }
};

class NetShowDatabase {
  private profiles: Profile[] = [];
  private history = new Map<string, WatchHistoryItem[]>();
  private favorites = new Map<string, Set<string>>();
  private catalog: CatalogItem[] = [];
  private customPlaylistRaw?: string;
  // Never send provider URLs to the client. Raw variant source mapping remains server-only.
  private variantRegistry = new Map<string, PlaylistItem>();
  private legacyIdRegistry = new Map<string,string>();
  private hlsAlternatives = new Map<string, PlaylistItem[]>();
  private stateFile = path.join(process.cwd(), 'data', 'netshow-state.json');

  public setHlsAlternatives(content: string): void {
    const parsed = parseM3U(content);
    const map = new Map<string,PlaylistItem[]>();
    for (const media of parsed.items.filter(x => x.streamType === 'hls')) {
      const key = consolidationKey(media);
      map.set(key,[...(map.get(key)||[]),media]);
    }
    this.hlsAlternatives=map;
  }

  public getStreamForDevice(contentId: string, preferHls: boolean, variantId?: string): {url:string;kind:'hls'|'mpegts'|'mp4';variantId:string} | null {
    const item=this.getContentById(contentId);
    if (!item) return null;
    const variants=item.variants || [];
    const requested = variantId ? variants.find(v=>v.id === variantId) : undefined;
    if (variantId && !requested) return null;
    const selected=requested || variants[0];
    if (!selected) return null;
    const source=this.variantRegistry.get(selected.id);
    if (!source) return null;
    if (preferHls && source.streamType==='mpegts') {
      const key=consolidationKey(source);
      const alternatives=this.hlsAlternatives.get(key)||[];
      // Match quality+language where available, fallback to a valid provider alternative.
      const alternate=alternatives.find(a=>a.name.toLowerCase()===source.name.toLowerCase()) || alternatives[0];
      if (alternate) return {url:alternate.streamUrl,kind:'hls',variantId:selected.id};
    }
    return {url:source.streamUrl,kind:source.streamType,variantId:selected.id};
  }

  private loadStateFromFile(): boolean {
    try {
      if (!fs.existsSync(this.stateFile)) return false;
      const state = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
      if (!Array.isArray(state.profiles) || !state.profiles.length) return false;
      this.profiles = state.profiles;
      const shipped:Record<string,string>={'prof-kids-1':'Kids World','prof-adult-locked':'Alex','prof-cinema':'Cinema Buff'};
      const unused=(id:string)=>!(state.history||[]).find((x:any)=>x[0]===id)?.[1]?.length&&!(state.favorites||[]).find((x:any)=>x[0]===id)?.[1]?.length;
      const before=this.profiles.length;
      this.profiles=this.profiles.filter(p=>!(shipped[p.id]===p.name&&!p.hasPin&&p.avatar.startsWith('avatar-')&&unused(p.id)));
      for(const p of this.profiles)if(p.avatar.startsWith('avatar-'))p.avatar='disney_01';
      if(before!==this.profiles.length){fs.copyFileSync(this.stateFile,this.stateFile+'.before-profile-migration');}

      this.history = new Map(state.history || []);
      this.favorites = new Map((state.favorites || []).map(([id, vals]: [string, string[]]) => [id, new Set(vals)]));
      this.saveState();
      return true;
    } catch (e) {
      console.warn('[NetShow] Could not restore saved profiles; using defaults.');
      return false;
    }
  }

  private saveState(): void {
    try {
      fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
      const payload = {
        profiles: this.profiles,
        history: [...this.history].map(([id, records]) => [id, records.map(({ streamUrl, ...rest }) => ({ ...rest, streamUrl: '' }))]),
        favorites: [...this.favorites].map(([id, value]) => [id, [...value]])
      };
      fs.writeFileSync(this.stateFile, JSON.stringify(payload), { mode: 0o600 });
    } catch (e) { console.error('[NetShow] Could not persist profile data'); }
  }

  public hasCatalog(): boolean { return this.catalog.length > 0; }
  public contentCount(): number { return this.catalog.length; }

  constructor() {
    if (!this.loadStateFromFile()) this.initDefaultProfiles();
    if (process.env.NETSHOW_DEMO_CATALOG === 'true') this.loadCatalog(DEFAULT_AUTHORIZED_M3U);
  }

  private initDefaultProfiles() {
    this.profiles.push({id:'prof-adult-main',name:'My Profile',avatar:'disney_01',isKid:false,hasPin:false,createdAt:Date.now()});
    this.saveState();
  }

  public loadCatalog(m3uContent: string) {
    this.loadPlaylistItems(parseM3U(m3uContent).items);
  }

  public loadPlaylistItems(items: PlaylistItem[], preserveEpisodes = false): void {
    const episodes = preserveEpisodes ? this.catalog.filter(x=>x.season && x.episode) : [];
    const oldVariants = this.variantRegistry;
    const grouped=groupCatalog(items);
    this.variantRegistry=grouped.rawByVariant;
    for (const episode of episodes) for (const v of episode.variants || []) {
      const raw=oldVariants.get(v.id);if(raw)this.variantRegistry.set(v.id,raw);
    }
    this.legacyIdRegistry = new Map();
    for (const item of grouped.items) {
      for (const v of item.variants) {
        const raw=this.variantRegistry.get(v.id);
        if (raw) this.legacyIdRegistry.set(raw.id,item.id);
      }
    }
    this.catalog = grouped.items.map(item => {
      const enriched = ENRICHED_METADATA[item.name] || {};
      const fallbackBackdrop = item.logoUrl || '/moroshow-icon.png';
      return {
        ...item,
        overview: enriched.overview || '',
        backdropUrl: enriched.backdropUrl || fallbackBackdrop,
        ratingBadge: enriched.ratingBadge || '',
        durationMinutes: enriched.durationMinutes,
        // Public variant summaries contain IDs, labels, and types only — no upstream URLs.
        variants:item.variants,
      };
    });
    const present = new Set(this.catalog.map(x=>x.id));
    this.catalog.push(...episodes.filter(x=>!present.has(x.id)));
  }

  public applyGatewayMetadata(meta: {name:string;overview?:string;poster?:string;backdrop?:string}[]):void{
    const byName=new Map(meta.map(m=>[m.name.toLowerCase(),m]));
    for(const item of this.catalog){
      const data=byName.get(item.name.toLowerCase());
      if(!data)continue;
      if(data.poster)item.logoUrl=data.poster;
      if(data.backdrop)item.backdropUrl=data.backdrop;
      if(data.overview)item.overview=data.overview;
    }
  }

  /** Register on-demand series episodes without a full live/VOD catalog reload. */
  public registerEpisodes(items: PlaylistItem[]): CatalogItem[] {
    const grouped = groupCatalog(items);
    for (const [variantId, original] of grouped.rawByVariant) this.variantRegistry.set(variantId, original);
    const newItems: CatalogItem[] = grouped.items.map(item => ({
      ...item, overview: '', backdropUrl: item.logoUrl || '/moroshow-icon.png',
      ratingBadge: '', variants: item.variants
    }));
    const existing = new Set(this.catalog.map(x => x.id));
    for (const entry of newItems) {
      if (!existing.has(entry.id)) { this.catalog.push(entry); existing.add(entry.id); }
    }
    return newItems;
  }

  // Profile operations
  public getProfiles(): Profile[] {
    // Hide sensitive pinHash and salt from client responses
    return this.profiles.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isKid: p.isKid,
      hasPin: p.hasPin,
      createdAt: p.createdAt
    }));
  }

  public getProfileById(id: string): Profile | undefined {
    return this.profiles.find(p => p.id === id);
  }

  public createProfile(data: { name: string; avatar: string; isKid: boolean; pin?: string }): Profile {
    const id = `prof-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    let salt: string | undefined;
    let pinHash: string | undefined;

    if (data.pin && data.pin.length === 4) {
      salt = generateSalt();
      pinHash = hashPin(data.pin, salt);
    }

    const newProfile: Profile = {
      id,
      name: data.name.trim(),
      avatar: data.avatar || 'disney_01',
      isKid: Boolean(data.isKid),
      hasPin: Boolean(pinHash),
      pinSalt: salt,
      pinHash: pinHash,
      createdAt: Date.now()
    };

    this.profiles.push(newProfile);
    this.saveState();
    return {
      id: newProfile.id,
      name: newProfile.name,
      avatar: newProfile.avatar,
      isKid: newProfile.isKid,
      hasPin: newProfile.hasPin,
      createdAt: newProfile.createdAt
    };
  }

  public updateProfile(id: string, data: { name?: string; avatar?: string; isKid?: boolean; pin?: string | null }): Profile | null {
    const prof = this.profiles.find(p => p.id === id);
    if (!prof) return null;

    if (data.name !== undefined) prof.name = data.name.trim();
    if (data.avatar !== undefined) prof.avatar = data.avatar;
    if (data.isKid !== undefined) prof.isKid = Boolean(data.isKid);

    if (data.pin === null) {
      // Remove PIN
      prof.hasPin = false;
      delete prof.pinSalt;
      delete prof.pinHash;
    } else if (data.pin && data.pin.length === 4) {
      // Set/update PIN
      const salt = generateSalt();
      prof.pinSalt = salt;
      prof.pinHash = hashPin(data.pin, salt);
      prof.hasPin = true;
    }

    this.saveState();
    return {
      id: prof.id,
      name: prof.name,
      avatar: prof.avatar,
      isKid: prof.isKid,
      hasPin: prof.hasPin,
      createdAt: prof.createdAt
    };
  }

  public deleteProfile(id: string): boolean {
    const initialLen = this.profiles.length;
    this.profiles = this.profiles.filter(p => p.id !== id);
    this.history.delete(id);
    this.favorites.delete(id);
    this.saveState();
    return this.profiles.length < initialLen;
  }

  public verifyProfilePin(id: string, pin: string) {
    const prof = this.profiles.find(p => p.id === id);
    if (!prof) return { success: false, error: 'Profile not found' };
    if (!prof.hasPin || !prof.pinHash || !prof.pinSalt) return { success: true };

    return verifyPinWithRateLimit(id, pin, prof.pinHash, prof.pinSalt);
  }

  // Watch History
  public getWatchHistory(profileId: string): WatchHistoryItem[] {
    return this.history.get(profileId) || [];
  }

  public saveWatchHistory(profileId: string, item: WatchHistoryItem): void {
    const list = this.history.get(profileId) || [];
    const filtered = list.filter(h => h.contentId !== item.contentId);
    filtered.unshift(item);
    // Keep last 30 items
    this.history.set(profileId, filtered.slice(0, 30));
    this.saveState();
  }

  public clearWatchHistory(profileId: string): void {
    this.history.set(profileId, []);
    this.saveState();
  }

  // Favorites
  public getFavorites(profileId: string): string[] {
    const set = this.favorites.get(profileId);
    return set ? Array.from(set) : [];
  }

  public addFavorite(profileId: string, contentId: string): void {
    let set = this.favorites.get(profileId);
    if (!set) {
      set = new Set<string>();
      this.favorites.set(profileId, set);
    }
    set.add(contentId);
    this.saveState();
  }

  public removeFavorite(profileId: string, contentId: string): void {
    const set = this.favorites.get(profileId);
    if (set) {
      set.delete(contentId);
      this.saveState();
    }
  }

  // Catalog queries
  public getCatalog(isKidProfile: boolean = false): {
    items: CatalogItem[];
    categories: string[];
    liveChannels: CatalogItem[];
    movies: CatalogItem[];
    series: CatalogItem[];
  } {
    const items = isKidProfile
      ? this.catalog.filter(item => item.isKidFriendly)
      : this.catalog;

    const categories = Array.from(new Set(items.map(i => i.category))).sort();
    const liveChannels = items.filter(i => i.kind === 'live' && i.category !== 'Cricify Events');
    const movies = items.filter(i => i.kind === 'movie');
    const seenSeries = new Set<string>();
    const series = items.filter(i => {
      if (i.kind !== 'series') return false;
      const key = (i.seriesTitle || i.name).toLowerCase();
      if (seenSeries.has(key)) return false;
      seenSeries.add(key);
      return true;
    });

    return {
      items,
      categories,
      liveChannels,
      movies,
      series
    };
  }

  public getContentById(contentId: string): CatalogItem | undefined {
    return this.catalog.find(c => c.id === (this.legacyIdRegistry.get(contentId)||contentId));
  }
}

export const db = new NetShowDatabase();
