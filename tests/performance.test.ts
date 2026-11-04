import test from 'node:test';
import assert from 'node:assert/strict';
import {singleFlight} from '../src/server/singleFlight';
import {ProgressiveRefresh} from '../src/server/progressiveRefresh';
const gate=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};};
test('a usable TV directory is returned while another provider is still pending',async()=>{
 const refresh=new ProgressiveRefresh(),slow=gate();let complete=false,calls=0;
 const all=refresh.start(async()=>{calls++;refresh.publish();await slow.promise;complete=true;});
 const duplicate=refresh.start(async()=>{throw Error('Duplicate refresh');});
 assert.equal(all,duplicate);
 await refresh.waitForFirst();assert.equal(complete,false);assert.equal(calls,1);assert.equal(refresh.refreshing,true);
 slow.resolve();await all;assert.equal(refresh.refreshing,false);assert.equal(complete,true);
});
test('empty or failed directory refresh settles instead of hanging',async()=>{
 const refresh=new ProgressiveRefresh();const all=refresh.start(async()=>{});await refresh.waitForFirst();await all;assert.equal(refresh.refreshing,false);
 const failed=refresh.start(async()=>{throw Error('offline');});await assert.rejects(failed,/offline/);await refresh.waitForFirst();
});
test('overlapping account reads coalesce, remain token-scoped and do not cache sessions',async()=>{
 const read=singleFlight<number>(),wait=gate();let calls=0;
 const work=async()=>{calls++;await wait.promise;return calls;};
 const a=read('account-a',work),b=read('account-a',work),c=read('account-b',work);
 assert.equal(a,b);assert.notEqual(a,c);wait.resolve();await Promise.all([a,b,c]);assert.equal(calls,2);
 await read('account-a',async()=>++calls);assert.equal(calls,3);
 await assert.rejects(read('invalid',async()=>{throw Error('expired');}),/expired/);
 assert.equal(await read('invalid',async()=>4),4);
});
