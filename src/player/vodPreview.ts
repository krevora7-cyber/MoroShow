import type { CatalogItem, StreamTokenResponse } from '../types';

export function isVodPreview() {
  return window.location.hostname === 'moro-show-git-codex-moroshow-direct-vod-goats-0196.vercel.app';
}

const samples = [
  { id: 'demo-mp4', label: 'MP4 demo', streamType: 'mp4', streamUrl: 'https://video.blender.org/object-storage/web_videos/6402b77c-b61f-4a06-96ca-c8420a2becf4-480.mp4' },
  { id: 'demo-hls', label: 'HLS demo', streamType: 'hls', streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
] as const;

export const vodDemoItem: CatalogItem = {
  id: 'w32:movie:10378', name: 'Big Buck Bunny', kind: 'movie', category: 'Playback demo',
  streamUrl: '', streamType: 'mp4', isKidFriendly: false,
};

export function vodPreviewPlayback(item: CatalogItem, variantId?: string): StreamTokenResponse | undefined {
  if (!isVodPreview() || item.id !== vodDemoItem.id) return;
  const sample = samples.find(entry => entry.id === variantId);
  if (!sample) return;
  return {
    success: true, token: crypto.randomUUID(), content: item, variantId: sample.id,
    streamType: sample.streamType, streamUrl: sample.streamUrl,
    variants: samples.map(({ id, label }) => ({ id, label })),
  };
}
