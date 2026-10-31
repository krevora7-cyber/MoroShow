import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NETSHOW_REPOSITORIES, NETSHOW_SOURCES, inspectSelectedSources, parseSelectedSources } from './netshowSources.ts';

const fixtures = {
  cnc: [
    { internalName:'CNC Verse', url:NETSHOW_REPOSITORIES.cnc.prefix + 'CNC Verse.cs3', version:115, tvTypes:['Movie','TvSeries'] },
    { internalName:'CricifyProvider', url:NETSHOW_REPOSITORIES.cnc.prefix + 'CricifyProvider.cs3', version:75, tvTypes:['Live'] },
    { internalName:'AnotherProvider', url: NETSHOW_REPOSITORIES.cnc.prefix + 'another.cs3' },
  ],
  phisher: [{ internalName:'StreamPlay', url:NETSHOW_REPOSITORIES.phisher.prefix + 'StreamPlay.cs3', tvTypes:['Movie','TvSeries'] }],
  arabi: [{ internalName:'Yacintv', url:NETSHOW_REPOSITORIES.arabi.prefix + 'Yacintv.cs3', tvTypes:['Live'] }],
};

test('exactly four requested sources and routing, without Xtream or Vietnamese add-ons', () => {
  assert.deepEqual(NETSHOW_SOURCES.map(s => s.id), ['cnc-verse','streamplay','yacintv','cricify']);
  const result = parseSelectedSources(fixtures);
  assert.equal(result.length, 4);
  assert.ok(result.every(r => r.listed));
  assert.deepEqual(result.find(r => r.id === 'cricify')?.sections, ['events']);
  assert.deepEqual(result.find(r => r.id === 'yacintv')?.sections, ['live']);
  assert.ok(result.every(r => r.playable === false));
});

test('rejects swapped .cs3 location and does not claim streams', () => {
  const result = parseSelectedSources({ arabi: [{internalName:'Yacintv', url:'http://127.0.0.1/private.cs3'}] });
  assert.equal(result.find(r => r.id === 'yacintv')?.listed, false);
  assert.ok(result.every(r => r.playable === false));
});

test('fetches exactly three fixed manifests and three fixed plugin lists with mocked transport', async () => {
  const calls: string[] = [];
  const fetcher = async (value: string | URL | Request) => {
    const url = String(value); calls.push(url);
    const id = (Object.keys(NETSHOW_REPOSITORIES) as Array<keyof typeof NETSHOW_REPOSITORIES>)
      .find(name => url === NETSHOW_REPOSITORIES[name].repository || url === NETSHOW_REPOSITORIES[name].plugins);
    assert.ok(id);
    const body = url === NETSHOW_REPOSITORIES[id].repository ? { pluginLists: [NETSHOW_REPOSITORIES[id].plugins] } : fixtures[id];
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const result = await inspectSelectedSources(fetcher as typeof fetch);
  assert.equal(calls.length, 6);
  assert.equal(result.sources.filter(s => s.listed).length, 4);
  assert.equal(result.warnings.length, 0);
});

test('repository failure is isolated to its sources', async () => {
  const fetcher = async (url: string | URL | Request) => {
    const source = String(url);
    if (source.includes('/phisher98/')) throw new Error('offline');
    const id = source.includes('Abodabodd') ? 'arabi' : 'cnc';
    const body = source === NETSHOW_REPOSITORIES[id].repository ? {pluginLists: [NETSHOW_REPOSITORIES[id].plugins]} : fixtures[id];
    return new Response(JSON.stringify(body), {status:200});
  };
  const result = await inspectSelectedSources(fetcher as typeof fetch);
  assert.equal(result.sources.find(s => s.id === 'streamplay')?.listed, false);
  assert.equal(result.sources.find(s => s.id === 'yacintv')?.listed, true);
  assert.equal(result.warnings.length, 1);
});
