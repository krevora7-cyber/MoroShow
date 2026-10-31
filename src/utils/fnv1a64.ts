/**
 * 64-bit FNV-1a (Fowler-Noll-Vo) Hash Generator
 * 
 * Provides collision-resistant, deterministic 64-bit hashing for
 * IPTV stream URLs, channel names, and media IDs.
 */

const FNV_PRIME_64 = 0x100000001b3n;
const FNV_OFFSET_BASIS_64 = 0xcbf29ce484222325n;
const MASK_64 = 0xffffffffffffffffn;

/**
 * Computes 64-bit FNV-1a hash of a UTF-8 string, returned as a 16-character hexadecimal string.
 */
export function fnv1a64(input: string): string {
  let hash = FNV_OFFSET_BASIS_64;
  const encoder = new TextEncoder();
  const bytes = encoder.encode(input);

  for (let i = 0; i < bytes.length; i++) {
    hash ^= BigInt(bytes[i]);
    hash = (hash * FNV_PRIME_64) & MASK_64;
  }

  // Format as 16-character hex string with leading zeros
  return hash.toString(16).padStart(16, '0');
}

export interface ContentIdentifierParams {
  streamUrl: string;
  name: string;
  tvgId?: string;
  groupTitle?: string;
  season?: number;
  episode?: number;
}

/**
 * Generates a stable unique content ID combining primary metadata attributes.
 */
export function generateContentId(params: ContentIdentifierParams): string {
  const parts = [
    params.tvgId?.trim().toLowerCase() || '',
    params.name.trim().toLowerCase(),
    // Stable across temporary playlist URL changes and credential rotation.
    // The name, group and optional tvg-id/episode distinguish catalog items.
    params.groupTitle?.trim().toLowerCase() || '',
    params.season !== undefined ? `s${params.season}` : '',
    params.episode !== undefined ? `e${params.episode}` : ''
  ];
  return `ns-${fnv1a64(parts.join('::'))}`;
}
