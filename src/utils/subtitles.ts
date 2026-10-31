/** Convert standard SRT or WebVTT; reject HTML error pages and unsupported formats. */
export function subtitleToVtt(body: string): string {
  const clean = body.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trimStart();
  if (/^WEBVTT(?:\s|$)/.test(clean)) return clean;
  if (!/\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/.test(clean)) {
    throw new Error('Source did not supply supported SRT or WebVTT subtitles');
  }
  return 'WEBVTT\n\n' + clean.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
}
