export function isVodPreview() {
  const host = window.location.hostname;
  return host === 'moro-show-git-codex-moroshow-direct-vod-goats-0196.vercel.app' ||
    host === 'moro-show-git-codex-moro-tv-xtream-preview-goats-0196.vercel.app';
}
