export type BrowserPlaybackMode = 'standard' | 'compatibility' | 'protected';
const origins = new Set(['https://vidstuck.cc','https://player.videasy.ws','https://cinesrc.st','https://player.cinezo.live','https://vidsrc.mov','https://vidlink.pro','https://vidsrc.sh','https://dramatip.net']);
export const POPUP_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-presentation';
export function movieEmbedPlayback(raw: string) {
 const url = new URL(raw);
 if (url.origin !== 'https://cinesrc.st') throw Error('This movie embed is unavailable');
 if (!url.searchParams.has('quality')) url.searchParams.set('quality', '720');
 return browserPlayback(url.href, 'protected');
}
export function browserPlayback(raw: string, mode: BrowserPlaybackMode) {
 const url = new URL(raw);
 if (!origins.has(url.origin) || url.username || url.password) throw Error('Unsupported player address');
 if (mode === 'protected') {
  return {url:url.href,sandbox:POPUP_SANDBOX,referrerPolicy:'strict-origin-when-cross-origin' as const};
 }
 if (mode === 'compatibility' && url.origin === 'https://vidlink.pro') url.searchParams.set('player','jw');
 return {url:url.href,sandbox:undefined,referrerPolicy:mode === 'compatibility' ? 'origin' as const : 'strict-origin-when-cross-origin' as const};
}

