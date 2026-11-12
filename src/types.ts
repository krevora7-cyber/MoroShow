/**
 * NetShow Type Definitions
 */

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  isKid: boolean;
  hasPin: boolean;
  createdAt: number;
}

export type ContentKind = 'live' | 'movie' | 'series';
export type StreamType = 'hls' | 'mpegts' | 'mp4';

export interface StreamVariant {
  id: string;
  quality: '4K' | 'FHD' | 'HD' | 'SD' | 'Unknown';
  language?: string;
  label: string;
  streamType: StreamType;
}

export interface CatalogItem {
  genreIds?: number[];
  ageRating?: string;
  kidsVerified?: boolean;
  trailerId?: string;
  id: string;
  name: string;
  streamUrl: string;
  streamType: StreamType;
  kind: ContentKind;
  category: string;
  logoUrl?: string;
  backdropUrl?: string;
  tvgId?: string;
  epgName?: string;
  seriesTitle?: string;
  season?: number;
  episode?: number;
  isKidFriendly: boolean;
  overview?: string;
  year?: number;
  ratingBadge?: string;
  durationMinutes?: number;
  variants?: StreamVariant[];
}

export interface WatchHistoryItem {
  contentId: string;
  name: string;
  streamUrl: string;
  streamType: StreamType;
  kind: ContentKind;
  category: string;
  posterUrl?: string;
  currentTime: number;
  duration: number;
  progressPercent: number;
  updatedAt: number;
}

export interface StreamTokenResponse {
  playbackMode?: 'direct-only';
  playbackNote?: string;
  embedUrl?: string;
  variants?: {id:string;label:string;kind?:'embed'|'direct'}[];
  subtitles?: {url:string;lang:string;label:string}[];
  success: boolean;
  token: string;
  streamType: StreamType;
  streamUrl: string;
  variantId?: string;
  content: {
    id: string;
    name: string;
    kind: ContentKind;
    category: string;
    logoUrl?: string;
    backdropUrl?: string;
    ratingBadge?: string;
    overview?: string;
    season?: number;
    episode?: number;
    seriesTitle?: string;
  };
  error?: string;
}

export interface AvatarOption {
  id: string;
  label: string;
  bgColor: string;
  emoji?: string;
  image: string;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  {id: 'disney_01', label: 'disney 01', bgColor: 'bg-neutral-900', image: '/avatars/disney_01.webp'},
  {id: 'disney_02', label: 'disney 02', bgColor: 'bg-neutral-900', image: '/avatars/disney_02.webp'},
  {id: 'disney_03', label: 'disney 03', bgColor: 'bg-neutral-900', image: '/avatars/disney_03.webp'},
  {id: 'disney_04', label: 'disney 04', bgColor: 'bg-neutral-900', image: '/avatars/disney_04.webp'},
  {id: 'disney_05', label: 'disney 05', bgColor: 'bg-neutral-900', image: '/avatars/disney_05.webp'},
  {id: 'disney_06', label: 'disney 06', bgColor: 'bg-neutral-900', image: '/avatars/disney_06.webp'},
  {id: 'featured_01_extra', label: 'featured 01 extra', bgColor: 'bg-neutral-900', image: '/avatars/featured_01_extra.webp'},
  {id: 'featured_01', label: 'featured 01', bgColor: 'bg-neutral-900', image: '/avatars/featured_01.webp'},
  {id: 'featured_02_extra', label: 'featured 02 extra', bgColor: 'bg-neutral-900', image: '/avatars/featured_02_extra.webp'},
  {id: 'featured_02', label: 'featured 02', bgColor: 'bg-neutral-900', image: '/avatars/featured_02.webp'},
  {id: 'featured_03_extra', label: 'featured 03 extra', bgColor: 'bg-neutral-900', image: '/avatars/featured_03_extra.webp'},
  {id: 'featured_03', label: 'featured 03', bgColor: 'bg-neutral-900', image: '/avatars/featured_03.webp'},
  {id: 'featured_04_extra', label: 'featured 04 extra', bgColor: 'bg-neutral-900', image: '/avatars/featured_04_extra.webp'},
  {id: 'featured_04', label: 'featured 04', bgColor: 'bg-neutral-900', image: '/avatars/featured_04.webp'},
  {id: 'featured_05_extra', label: 'featured 05 extra', bgColor: 'bg-neutral-900', image: '/avatars/featured_05_extra.webp'},
  {id: 'featured_05', label: 'featured 05', bgColor: 'bg-neutral-900', image: '/avatars/featured_05.webp'},
  {id: 'featured_06', label: 'featured 06', bgColor: 'bg-neutral-900', image: '/avatars/featured_06.webp'},
  {id: 'sonic_prime_01', label: 'sonic prime 01', bgColor: 'bg-neutral-900', image: '/avatars/sonic_prime_01.webp'},
  {id: 'sonic_prime_02', label: 'sonic prime 02', bgColor: 'bg-neutral-900', image: '/avatars/sonic_prime_02.webp'},
  {id: 'sonic_prime_03', label: 'sonic prime 03', bgColor: 'bg-neutral-900', image: '/avatars/sonic_prime_03.webp'},
  {id: 'sonic_prime_04', label: 'sonic prime 04', bgColor: 'bg-neutral-900', image: '/avatars/sonic_prime_04.webp'},
  {id: 'sonic_prime_05', label: 'sonic prime 05', bgColor: 'bg-neutral-900', image: '/avatars/sonic_prime_05.webp'},
  {id: 'sonic_prime_06', label: 'sonic prime 06', bgColor: 'bg-neutral-900', image: '/avatars/sonic_prime_06.webp'},
  {id: 'strange_new_worlds_01', label: 'strange new worlds 01', bgColor: 'bg-neutral-900', image: '/avatars/strange_new_worlds_01.webp'},
  {id: 'strange_new_worlds_02', label: 'strange new worlds 02', bgColor: 'bg-neutral-900', image: '/avatars/strange_new_worlds_02.webp'},
  {id: 'strange_new_worlds_03', label: 'strange new worlds 03', bgColor: 'bg-neutral-900', image: '/avatars/strange_new_worlds_03.webp'},
  {id: 'strange_new_worlds_04', label: 'strange new worlds 04', bgColor: 'bg-neutral-900', image: '/avatars/strange_new_worlds_04.webp'},
  {id: 'strange_new_worlds_05', label: 'strange new worlds 05', bgColor: 'bg-neutral-900', image: '/avatars/strange_new_worlds_05.webp'},
];
