export type BrowserPlaybackMode = 'standard' | 'compatibility' | 'protected';
const origins = new Set(['https://player.cinezo.live','https://vidsrc.mov','https://vidlink.pro','https://vidsrc.sh','https://dramatip.net']);
export const POPUP_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-presentation';
export function browserPlayback(raw: string, mode: BrowserPlaybackMode) {
 const url = new URL(raw);
 if (!origins.has(url.origin) || url.username || url.password) throw Error('Unsupported player address');
 if (mode === 'protected') {
  if (url.origin === 'https://dramatip.net') throw Error('No protected alternative for this source');
  const match = url.pathname.match(/^\/(?:embed\/)?(movie|tv)\/([1-9]\d*)(?:\/(\d+)\/(\d+))?\/?$/);
  if (!match || (match[1] === 'tv' && (!match[3] || !match[4]))) throw Error('No protected alternative for this title');
  const target = new URL(`https://cinesrc.st/embed/${match[1]}/${match[2]}`);
  if (match[1] === 'tv') { target.searchParams.set('s',match[3]); target.searchParams.set('e',match[4]); }
  target.searchParams.set('autoplay','false'); target.searchParams.set('autonext','false');
  target.searchParams.set('quality','720'); target.searchParams.set('back','close');
  const resume = Number(url.searchParams.get('startAt'));
  if (Number.isFinite(resume) && resume > 0) target.searchParams.set('t',String(Math.floor(resume)));
  return {url:target.href,sandbox:POPUP_SANDBOX,referrerPolicy:'strict-origin-when-cross-origin' as const};
 }
 if (mode === 'compatibility' && url.origin === 'https://vidlink.pro') url.searchParams.set('player','jw');
 return {url:url.href,sandbox:undefined,referrerPolicy:mode === 'compatibility' ? 'origin' as const : 'strict-origin-when-cross-origin' as const};
}
