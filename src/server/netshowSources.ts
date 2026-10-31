/**
 * NetShow v3.8 — deliberately restricted FOUR-source manifest registry.
 * Manifest discovery is not stream playback. No remote .cs3 executes here.
 * All manifest endpoints and plugin ids are fixed and allowlisted.
 */
export type NetShowSection = 'movies' | 'series' | 'live' | 'events';
export type SourceId = 'cnc-verse' | 'streamplay' | 'yacintv' | 'cricify';

export const NETSHOW_REPOSITORIES = Object.freeze({
  cnc: {
    repository: 'https://raw.githubusercontent.com/NivinCNC/CNCVerse-Cloud-Stream-Extension/refs/heads/builds/CNC.json',
    plugins: 'https://raw.githubusercontent.com/NivinCNC/CNCVerse-Cloud-Stream-Extension/builds/plugins.json',
    prefix: 'https://raw.githubusercontent.com/NivinCNC/CNCVerse-Cloud-Stream-Extension/builds/',
  },
  phisher: {
    repository: 'https://raw.githubusercontent.com/phisher98/cloudstream-extensions-phisher/refs/heads/builds/repo.json',
    plugins: 'https://raw.githubusercontent.com/phisher98/cloudstream-extensions-phisher/refs/heads/builds/plugins.json',
    prefix: 'https://raw.githubusercontent.com/phisher98/cloudstream-extensions-phisher/builds/',
  },
  arabi: {
    repository: 'https://raw.githubusercontent.com/Abodabodd/re-3arabi/refs/heads/main/repo',
    plugins: 'https://raw.githubusercontent.com/Abodabodd/re-3arabi/refs/heads/builds/plugins.json',
    prefix: 'https://raw.githubusercontent.com/Abodabodd/re-3arabi/builds/',
  },
} as const);

type RepositoryId = keyof typeof NETSHOW_REPOSITORIES;

export interface SourceConfig {
  id: SourceId;
  name: string;
  internalName: string;
  repo: RepositoryId;
  sections: readonly NetShowSection[];
  description: string;
}

export const NETSHOW_SOURCES: readonly SourceConfig[] = Object.freeze([
  { id: 'cnc-verse', name: 'CNC Verse', internalName: 'CNC Verse', repo: 'cnc', sections: ['movies', 'series'], description: 'Netflix-style catalog listing; this is not an official Netflix integration.' },
  { id: 'streamplay', name: 'StreamPlay', internalName: 'StreamPlay', repo: 'phisher', sections: ['movies', 'series'], description: 'Movies and series extension listed in Phisher.' },
  { id: 'yacintv', name: 'Yacintv', internalName: 'Yacintv', repo: 'arabi', sections: ['live'], description: 'Live TV extension from the Arabic repository.' },
  { id: 'cricify', name: 'Cricify', internalName: 'CricifyProvider', repo: 'cnc', sections: ['events'], description: 'Sports / live extension; event schedule not guaranteed by the manifest.' },
] as const);

type RawEntry = { internalName?: unknown; name?: unknown; url?: unknown; tvTypes?: unknown; status?: unknown; version?: unknown };
export interface InspectedSource {
  id: SourceId;
  name: string;
  sections: readonly NetShowSection[];
  repository: string;
  listed: boolean;
  version: number | null;
  reportedTypes: string[];
  pluginUrl: string | null;
  playable: false;
  message: string;
}

export function parseSelectedSources(manifests: Partial<Record<RepositoryId, unknown>>): InspectedSource[] {
  return NETSHOW_SOURCES.map(config => {
    const repository = NETSHOW_REPOSITORIES[config.repo];
    const rows = manifests[config.repo];
    const matches = Array.isArray(rows) ? rows.filter((x: RawEntry) => x && typeof x === 'object' && x.internalName === config.internalName) : [];
    const entry = matches[0] as RawEntry | undefined;
    // Trust the exact fixed GitHub raw prefix, and reject URL controls and redirects.
    let pluginUrl: string | null = null;
    if (typeof entry?.url === 'string' && !/[\u0000-\u001f]/.test(entry.url)) {
      try {
        // GitHub manifests sometimes have literal spaces in .cs3 file names.
        const normalized = new URL(entry.url).href;
        if (normalized.startsWith(repository.prefix) && normalized.endsWith('.cs3')) pluginUrl = normalized;
      } catch { /* Malformed URL; keep source unavailable. */ }
    }
    return {
      id: config.id,
      name: config.name,
      sections: config.sections,
      repository: repository.repository,
      listed: Boolean(pluginUrl),
      version: typeof entry?.version === 'number' && Number.isFinite(entry.version) ? entry.version : null,
      reportedTypes: Array.isArray(entry?.tvTypes) ? entry.tvTypes.filter((x: unknown): x is string => typeof x === 'string').slice(0, 12) : [],
      pluginUrl,
      playable: false,
      message: pluginUrl
        ? 'Plugin published. Android CloudStream runtime or a separately implemented authorized adapter required for playback.'
        : 'Not verified in current published plugin list. No playback available.',
    };
  });
}

async function fetchBoundedJson(fetcher: typeof fetch, url: string, limit: number): Promise<unknown> {
  const response = await fetcher(url, { headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(9500) });
  if (!response.ok) throw new Error(`Manifest request failed (HTTP ${response.status})`);
  if (Number(response.headers.get('content-length') || 0) > limit) throw new Error('Manifest exceeds size limit');
  const text = await response.text();
  if (text.length > limit) throw new Error('Manifest exceeds size limit');
  return JSON.parse(text);
}

const TTL_MS = 10 * 60 * 1000;
let cached: { at: number; sources: InspectedSource[]; warnings: string[] } | null = null;
let inFlight: Promise<{ at: number; sources: InspectedSource[]; warnings: string[] }> | null = null;

export async function inspectSelectedSources(fetcher: typeof fetch = fetch) {
  if (fetcher === fetch && cached && Date.now() - cached.at < TTL_MS) return { ...cached, cached: true };
  if (fetcher === fetch && inFlight) return { ...(await inFlight), cached: false };
  const load = async () => {
    const manifests: Partial<Record<RepositoryId, unknown>> = {};
    const warnings: string[] = [];
    await Promise.all((Object.keys(NETSHOW_REPOSITORIES) as RepositoryId[]).map(async id => {
      const repo = NETSHOW_REPOSITORIES[id];
      try {
        const definition = await fetchBoundedJson(fetcher, repo.repository, 30_000);
        const lists = definition && typeof definition === 'object' && !Array.isArray(definition) ? (definition as any).pluginLists : null;
        if (!Array.isArray(lists) || !lists.includes(repo.plugins)) throw new Error('Unexpected pluginLists in repo manifest');
        const plugins = await fetchBoundedJson(fetcher, repo.plugins, 1_300_000);
        if (!Array.isArray(plugins) || plugins.length > 400) throw new Error('Invalid or overly large plugins array');
        manifests[id] = plugins;
      } catch (e) { warnings.push(`${id}: ${(e as Error).message}`); }
    }));
    const result = { at: Date.now(), sources: parseSelectedSources(manifests), warnings };
    if (fetcher === fetch) cached = result;
    return result;
  };
  if (fetcher !== fetch) return { ...(await load()), cached: false };
  inFlight = load().finally(() => { inFlight = null; });
  return { ...(await inFlight), cached: false };
}
