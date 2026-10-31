/** Server-side catalog consolidation: many provider streams -> one browsable title. */
import { fnv1a64 } from './fnv1a64.ts';
import type { PlaylistItem } from './m3uParser.ts';

export type QualityLabel = '4K' | 'FHD' | 'HD' | 'SD' | 'Unknown';
export interface PublicVariant {
  id: string;                 // opaque stable source selector, never contains an upstream URL
  quality: QualityLabel;      // inferred from provider label, not an actual resolution probe
  language?: string;          // named source language, not necessarily a switchable audio track
  label: string;
  streamType: PlaylistItem['streamType'];
}
export interface GroupedCatalogItem extends PlaylistItem {
  variants: PublicVariant[];
}
const QREG = /(?:^|[\s()[\]{}|:_-])(4\s*K|UHD|2160P|FULL\s*HD|FHD|1080P|HD|720P|SD|576P|480P)(?=$|[\s()[\]{}|:_-])/ig;
const CODEC_REG = /(?:^|[\s()[\]{}|:_-])(HEVC|H\.?26[45]|X26[45]|AAC)(?=$|[\s()[\]{}|:_-])/ig;
const LNG_REG = /(?:^|[\s()[\]{}|:_-])(VOSTFR|MULTI|VF|VO|VFF|TRUEFRENCH|FRENCH|ENGLISH|ARABIC|FR|EN|AR|ES|DE|IT|PT)(?=$|[\s()[\]{}|:_-])/ig;
const langMap: Record<string,string> = {FRENCH:'FR', TRUEFRENCH:'FR',VFF:'FR',VF:'FR',ENGLISH:'EN', ARABIC:'AR'};
export function qualityOf(text: string): QualityLabel {
  const matches = [...text.matchAll(new RegExp(QREG.source,'gi'))].map(m => m[1].replace(/\s+/g,'').toUpperCase());
  if (matches.some(x => ['4K','UHD','2160P'].includes(x))) return '4K';
  if (matches.some(x => ['FHD','FULLHD','1080P'].includes(x))) return 'FHD';
  if (matches.some(x => ['HD','720P'].includes(x))) return 'HD';
  if (matches.some(x => ['SD','576P','480P'].includes(x))) return 'SD';
  return 'Unknown';
}
export function sourceLanguage(item: PlaylistItem): string | undefined {
  if (item.audioLanguage) return item.audioLanguage.toUpperCase();
  const matches = [...item.name.matchAll(new RegExp(LNG_REG.source,'gi'))];
  const code = matches.length ? matches[matches.length-1][1].toUpperCase() : '';
  return langMap[code] || code || undefined;
}
export function cleanedTitle(name: string, kind: PlaylistItem['kind']): string {
  let result = name.replace(new RegExp(QREG.source,'gi'),' ').replace(new RegExp(CODEC_REG.source,'gi'),' ');
  // Movie/episode versions may be in different languages; one title should show available versions.
  if (kind !== 'live') result = result.replace(new RegExp(LNG_REG.source,'gi'),' ');
  result = result.replace(/\(\s*\)|\[\s*\]|\{\s*\}/g,' ');
  // Strip quality markers at the beginning or end only; preserve title's genuine punctuation/numbers.
  return result.replace(/\s+/g,' ').replace(/^[\s|:_\-]+|[\s|:_\-]+$/g,'').trim() || name.trim();
}
export function consolidationKey(item: PlaylistItem): string {
  const base = cleanedTitle(item.kind==='series' && item.seriesTitle ? (item.season !== undefined && item.episode !== undefined ? `${item.seriesTitle} S${String(item.season).padStart(2,'0')}E${String(item.episode).padStart(2,'0')}` : item.seriesTitle) : item.name,item.kind);
  const simplified = base.normalize('NFKC').toLocaleLowerCase().replace(/[’‘]/g,"'").replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  // Include year to avoid collapsing remakes. Most providers append year to movie titles.
  // Keep country/language prefixes in live channel names (they are different broadcasts).
  return `${item.kind}:${simplified}`;
}
export function groupCatalog(raw: PlaylistItem[]): {items: GroupedCatalogItem[], rawByVariant: Map<string,PlaylistItem>} {
  const groups = new Map<string, GroupedCatalogItem>();
  const rawByVariant = new Map<string,PlaylistItem>();
  for (const item of raw) {
    const key = consolidationKey(item);
    const quality = qualityOf(item.name) !== 'Unknown' ? qualityOf(item.name) : qualityOf(item.category);
    const language = sourceLanguage(item);
    const sourceTag = language && language !== 'UNKNOWN' ? language : undefined;
    const label = `${quality}${sourceTag ? ` · ${sourceTag}` : ''}`;
    const variantId = `ns-v-${fnv1a64(item.id + '::' + item.streamUrl)}`;
    const variant: PublicVariant = {id:variantId,quality,language:sourceTag,label,streamType:item.streamType};
    rawByVariant.set(variantId,item);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key,{
        ...item,
        id:`ns-g-${fnv1a64(key)}`,
        name:cleanedTitle(item.name,item.kind),
        category:cleanedTitle(item.category,'live') || 'General',
        // Explicitly prevent exporting upstream stream URLs through grouped API objects.
        streamUrl:'',
        seriesTitle: item.seriesTitle ? cleanedTitle(item.seriesTitle,'series') : undefined,
        variants:[variant],
      });
    } else {
      // Dedupe identical URLs without deleting different quality/audio alternatives.
      const seen = existing.variants.some(v=>rawByVariant.get(v.id)?.streamUrl === item.streamUrl);
      if (!seen) existing.variants.push(variant);
      if (!existing.logoUrl && item.logoUrl) existing.logoUrl=item.logoUrl;
    }
  }
  const order:Record<QualityLabel,number>={'4K':4,FHD:3,HD:2,SD:1,Unknown:0};
  for (const item of groups.values()) {
    item.variants.sort((a,b)=>order[b.quality]-order[a.quality] || a.label.localeCompare(b.label));
    const best = item.variants[0];
    item.streamType=best.streamType;
    // category based on the first provider entry; avoid quality-only categories where possible.
  }
  return {items:[...groups.values()],rawByVariant};
}
