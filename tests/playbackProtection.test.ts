import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {validateRules,loadProtectionRules,BUNDLED_RULES,RULES_URL} from '../src/player/protectionRules';
const storage=()=>{const values=new Map<string,string>();return {getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>{values.set(k,v);}}};
test('blocking lists accept domains only and cannot block providers or account infrastructure',()=>{
 assert.deepEqual(validateRules(JSON.parse(fs.readFileSync('public/playback-blocklist.json','utf8'))),BUNDLED_RULES);
 for(const host of ['com','https://ads.example.com','*.example.com','ads.example.com/path','localhost','127.0.0.1','vidsrc.mov','mov','player.cinezo.live','supabase.co','evil.supabase.co','vercel.app'])assert.equal(validateRules({version:2,hosts:[host]}),null,host);
 assert.equal(validateRules({version:2,hosts:['ads.example.com']})?.hosts[0],'ads.example.com');
});
test('rules refresh is pinned, cached and retains working rules when offline or invalid',async()=>{
 const store=storage();let calls=0;const request=(async(url,options)=>{calls++;assert.equal(url,RULES_URL);assert.equal(options?.redirect,'error');assert.equal(options?.credentials,'omit');return Response.json({version:2,hosts:['ads.example.com']});}) as typeof fetch;
 assert.equal((await loadProtectionRules(false,store,request)).rules.version,2);assert.equal((await loadProtectionRules(false,store,request)).rules.version,2);assert.equal(calls,1);
 for(const body of [{version:1,hosts:['old.example.com']},{version:3,hosts:['vidlink.pro']},{version:3,hosts:[]}]){const result=await loadProtectionRules(true,store,(async()=>Response.json(body)) as typeof fetch);assert.equal(result.updated,false);assert.equal(result.rules.version,2);}
 assert.equal((await loadProtectionRules(true,store,(async()=>{throw Error('offline');}) as typeof fetch)).rules.version,2);assert.deepEqual((await loadProtectionRules(true,storage(),(async()=>{throw Error('offline');}) as typeof fetch)).rules,BUNDLED_RULES);
});
