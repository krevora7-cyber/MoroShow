type DirectSource = {
  id: string;
  label: string;
  streamUrl: string;
  streamType: 'hls' | 'mp4';
};

const titleId = /^w32:(?:movie:[1-9]\d*|tv:[1-9]\d*:[1-9]\d*:[1-9]\d*)$/;
const sourceId = /^(?:cinesrc|vidstuck|videasy|vidlink|native-[1-9]\d?)$/;

export function readDirectCatalog(raw: string | undefined): Map<string, DirectSource[]> {
  const catalog = new Map<string, DirectSource[]>();
  if (!raw) return catalog;
  const entries: unknown = JSON.parse(raw);
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    throw new Error('Invalid direct video catalog.');
  }
  for (const [id, list] of Object.entries(entries)) {
    if (!titleId.test(id) || !Array.isArray(list) || list.length > 8) {
      throw new Error('Invalid direct video catalog entry.');
    }
    const sources: DirectSource[] = [];
    for (const source of list) {
      if (!source || typeof source.id !== 'string' || !sourceId.test(source.id)
          || sources.some(existing => existing.id === source.id)
          || typeof source.label !== 'string' || !source.label.trim() || source.label.length > 64
          || typeof source.streamUrl !== 'string' || source.streamUrl.length > 8192) {
        throw new Error('Invalid direct video source.');
      }
      const url = new URL(source.streamUrl);
      if (url.protocol !== 'https:' || url.username || url.password) {
        throw new Error('Direct video sources require HTTPS.');
      }
      const streamType = source.streamType ?? 'hls';
      if (streamType !== 'hls' && streamType !== 'mp4') throw new Error('Unsupported direct video format.');
      sources.push({id: source.id, label: source.label.trim(), streamUrl: url.href, streamType});
    }
    catalog.set(id, sources);
  }
  return catalog;
}
