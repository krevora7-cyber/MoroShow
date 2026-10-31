import {test} from 'node:test';import assert from 'node:assert/strict';import express from 'express';
import {catalogPath,publicChannel,publicIp,safeUrl,rewrite,registerGeilTv} from '../src/server/geilTv';import {db} from '../src/server/db';
test('TV groups use observed provider filters and retain page cursors',()=>{const a=new URL(catalogPath('bein','','300'),'https://example.com');assert.equal(a.searchParams.get('search'),'bein sports');assert.equal(a.searchParams.get('filter[group]'),'Arabia');assert.equal(a.searchParams.get('cursor'),'300');const b=new URL(catalogPath('france','sport',''),'https://example.com');assert.equal(b.searchParams.get('filter[group]'),'France');assert.equal(b.searchParams.get('search'),'sport');});
test('public channels preserve real EPG and do not expose remote streams',()=>{const c=publicChannel({id:'123',name:'Test',url:'https://private.example/video',tags:['France'],epg:[{title:'Programme'}]})!;assert.equal(c.id,'geil:123');assert.equal(c.streamUrl,'');assert.equal(c.category,'France');assert.equal(c.epg[0].title,'Programme');assert.equal(publicChannel({id:'../x'}),null);});
test('media rejects local networks, credentials and protocols; HLS URIs become local leases',()=>{for(const ip of ['127.0.0.1','10.1.1.1','172.16.0.1','192.168.1.1','169.254.169.254','100.64.0.1'])assert.equal(publicIp(ip),false);assert.equal(publicIp('8.8.8.8'),true);for(const u of ['file:///etc/passwd','http://user:pass@example.com','http://localhost/a'])assert.throws(()=>safeUrl(u));const s=rewrite('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key"\nsegment.ts','https://example.com/live/index.m3u8');assert.equal((s.match(/\/api\/live\/media\//g)||[]).length,2);assert.ok(!s.includes('example.com'));});
test('TV routes require profiles, reject Kids and never proxy arbitrary client URLs',async()=>{const app=express();app.use(express.json());registerGeilTv(app);const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:'+(server.address()as any).port;try{assert.equal((await fetch(base+'/api/live/channels')).status,401);const kid=db.createProfile({name:'TV test kid',avatar:'disney_01',isKid:true});assert.equal((await fetch(base+'/api/live/channels?profileId='+kid.id)).status,403);db.deleteProfile(kid.id);assert.equal((await fetch(base+'/api/live/media/invalid')).status,410);const adult=db.getProfiles().find(p=>!p.isKid)!;const r=await fetch(base+'/api/live/play',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profileId:adult.id,contentId:'http://127.0.0.1'})});assert.equal(r.status,400);}finally{server.closeAllConnections();server.close();}});

test('fallback channel families never mix sports numbers, Premium, AFC or countries',async()=>{
 const {channelFamily,sameChannel}=await import('../src/server/geilTv');
 assert.equal(channelFamily('BEIN SPORTS 1 HD (BACKUP 3) (1)'),'BEIN SPORTS 1');
 const primary={id:'1',name:'BEIN SPORTS 1 HD (1)',tags:['Arabia']};
 assert.equal(sameChannel(primary,{id:'2',name:'BEIN SPORTS 1 SD (BACKUP) (1)',tags:['Arabia']}),true);
 for(const b of [
 {id:'2',name:'BEIN SPORTS 2 HD (1)',tags:['Arabia']},
 {id:'2',name:'BEIN SPORTS 1 PREMIUM (1)',tags:['Arabia']},
 {id:'2',name:'BEIN SPORTS 1 HD (1)',tags:['France']},
 {...primary},
 ])assert.equal(sameChannel(primary,b),false);
});

test('unavailable feed falls back only to the same channel and cancellation stops work',async()=>{
 const {chooseWorkingChannel}=await import('../src/server/geilTv');
 const a={id:'991',name:'CHECK SPORTS 1 HD (1)',tags:['Arabia']};
 const b={id:'992',name:'CHECK SPORTS 1 SD (BACKUP) (1)',tags:['Arabia']};
 publicChannel(a);const calls:string[]=[];
 const dependencies={catalog:async()=>({items:[a,b,{...b,id:'993',tags:['France']}]}),resolve:async(id:string)=>{calls.push(id);if(id==='991')throw new Error('HTML instead of media');return {url:'https://example.com/stream.m3u8',format:'hls'};}};
 const result=await chooseWorkingChannel('991',[],AbortSignal.timeout(1000),dependencies);
 assert.deepEqual(calls,['991','992']);assert.equal(result.sourceId,'992');assert.deepEqual(result.attemptedIds,['991','992']);
 const ac=new AbortController();ac.abort();calls.length=0;
 await assert.rejects(chooseWorkingChannel('991',[],ac.signal,dependencies));assert.deepEqual(calls,[]);
});
