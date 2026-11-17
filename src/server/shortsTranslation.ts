type Language = 'ar' | 'en';

const endpoint = 'https://translate.wmcloud.org/api/translate';
const cache = new Map<string, string>();
const scripts = [
  ['ar', /\p{Script=Arabic}/u],
  ['ja', /[\p{Script=Hiragana}\p{Script=Katakana}]/u],
  ['ko', /\p{Script=Hangul}/u],
  ['zh', /\p{Script=Han}/u],
  ['ru', /\p{Script=Cyrillic}/u],
  ['th', /\p{Script=Thai}/u],
  ['hi', /\p{Script=Devanagari}/u],
] as const;
const languageOf = (text: string) => scripts.find(([, script]) => script.test(text))?.[0] || 'en';

async function translate(content: string, format: 'json' | 'text', from: string, to: Language, signal: AbortSignal) {
  const response = await fetch(endpoint, {
    method: 'POST', redirect: 'error', signal,
    headers: {'Content-Type': 'application/json', 'User-Agent': 'MoroShow/1.0 (Shorts metadata translation)'},
    body: JSON.stringify({format, content, source_language: from,
      target_language: to, model: 'nllb200-600M'}),
  });
  if (!response.ok) {
    await response.body?.cancel();
    return;
  }
  const {translation} = await response.json();
  return typeof translation === 'string' ? translation : undefined;
}

export async function translateShortsText(texts: string[], to: Language): Promise<string[]> {
  const cacheKey = (text: string) => to + ':' + text;
  const uncached = [...new Set(texts.filter(text => text.trim() && languageOf(text) !== to && !cache.has(cacheKey(text))))];
  const store = (original: string, translated: unknown) => {
    if (typeof translated !== 'string' || !translated.trim() || languageOf(translated) !== to) return;
    if (cache.size >= 3600) cache.delete(cache.keys().next().value!);
    cache.set(cacheKey(original), translated.trim());
  };
  const byLanguage = new Map<string, string[]>();
  for (const text of uncached) {
    const from = languageOf(text);
    const sameLanguage = byLanguage.get(from) || [];
    sameLanguage.push(text);
    byLanguage.set(from, sameLanguage);
  }
  const batches: {from:string; texts:string[]}[] = [];
  for (const [from, texts] of byLanguage) {
    for (let index = 0; index < texts.length; index += 5) batches.push({from, texts: texts.slice(index, index + 5)});
  }

  const deadline = AbortSignal.timeout(17000);
  await Promise.all(batches.map(async ({from, texts: batch}) => {
    const signal = AbortSignal.any([deadline, AbortSignal.timeout(12500)]);
    try {
      const content = Object.fromEntries(batch.map((text, index) => [String(index), text]));
      const translation = await translate(JSON.stringify(content), 'json', from, to, signal);
      if (!translation) return;
      const result = JSON.parse(translation) as Record<string, unknown>;
      for (const [index, original] of batch.entries()) store(original, result[index]);
    } catch { /* Retry a small number of missing translations as plain text below. */ }
  }));
  const missing = uncached.filter(text => !cache.has(cacheKey(text))).slice(0, 5);
  await Promise.all(missing.map(async text => {
    try { store(text, await translate(text, 'text', languageOf(text), to, deadline)); }
    catch { /* Keep the original text available if the translator is unavailable. */ }
  }));
  return texts.map(text => cache.get(cacheKey(text)) ?? text);
}
