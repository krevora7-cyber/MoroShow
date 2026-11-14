import test from 'node:test';
import assert from 'node:assert/strict';
import {mediaAddress,rewrite} from '../src/server/geilTv';
import {webTvAccount} from '../src/server/webTvAccount';

test('uses only the configured Xtream catalog and keeps playback credentials server-side', async () => {
  const actions: string[] = [];
  const config = JSON.stringify({base:'https://tv.example',username:'fixture-user',password:'secret/pass'});
  const account = webTvAccount(config, async url => {
    assert.equal(url.origin,'https://tv.example');
    assert.equal(url.pathname,'/player_api.php');
    assert.equal(url.searchParams.get('password'),'secret/pass');
    const action = url.searchParams.get('action') ?? '';
    actions.push(action);
    return action === 'get_live_categories'
      ? [{category_id:'3',category_name:'News'}]
      : [{stream_id:'12',category_id:'3',name:'Account Channel'},{stream_id:'../private',name:'Invalid'}];
  });
  const [first,second] = await Promise.all([account.catalog(),account.catalog()]);
  assert.equal(first,second);
  assert.deepEqual(actions.sort(),['get_live_categories','get_live_streams']);
  const [channel] = first.values();
  assert.equal(first.size,1);
  assert.equal(channel.category,'News');
  assert.match(channel.id,/^xtream:[a-f0-9]{24}$/);
  assert.equal(new URL(channel.sources[0].url).pathname,'/live/fixture-user/secret%2Fpass/12.m3u8');
  await assert.rejects(webTvAccount('').catalog(),/not been configured/);
});


test('account media leases keep redirects and playlist resources within the authorized origin', () => {
  const policy = {origin:'http://tv.example',mediaOrigins:new Set(['http://approved.example:8000'])};
  assert.equal(mediaAddress('http://approved.example:8000/live/test.m3u8', undefined, policy).hostname,'approved.example');
  assert.throws(() => mediaAddress('http://approved.example/live/test.m3u8', undefined, policy), /Unapproved/);
  assert.equal(mediaAddress('/live/test.m3u8', 'http://tv.example', policy).origin,policy.origin);
  assert.throws(() => mediaAddress('http://media.example/live/credentials', undefined, policy), /Unapproved/);
  assert.throws(() => rewrite('#EXTM3U\nhttp://media.example/segment.ts', policy.origin, policy), /Unapproved/);
  const rewritten = rewrite('#EXTM3U\n/live/user/password/segment.ts', policy.origin, policy);
  assert.match(rewritten,/\/api\/live\/media\/[a-f0-9]{48}/);
  assert.doesNotMatch(rewritten,/password/);
});
