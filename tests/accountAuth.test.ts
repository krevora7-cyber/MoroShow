import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {registerAccountAuth} from '../src/server/accountAuth';
import {db,NetShowDatabase,withAccountDatabase} from '../src/server/db';
const a='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
test('account scopes remain isolated across asynchronous requests',async()=>{
 const one=new NetShowDatabase(null),two=new NetShowDatabase(null);const id1=one.getProfiles()[0].id,id2=two.getProfiles()[0].id;assert.notEqual(id1,id2);
 await Promise.all([withAccountDatabase(one,async()=>{await new Promise(r=>setTimeout(r,15));assert.equal(db.getProfiles()[0].id,id1);db.addFavorite(id1,'w32:movie:1');}),withAccountDatabase(two,async()=>{await new Promise(r=>setTimeout(r,5));assert.equal(db.getProfiles()[0].id,id2);assert.equal(db.getProfileById(id1),undefined);})]);
 assert.deepEqual(two.getFavorites(id2),[]);assert.deepEqual(one.getFavorites(id1),['w32:movie:1']);
});
test('API validates sessions, enforces ownership, persists changes and reports revision conflicts',async()=>{
 const oldFetch=global.fetch,oldUrl=process.env.SUPABASE_URL,oldKey=process.env.SUPABASE_PUBLISHABLE_KEY;
 process.env.SUPABASE_URL='https://account-test.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='public-test';
 const rows=new Map<string,any>();let failWrite=false;let server:any;
 global.fetch=(async(input:any,options:any={})=>{
  const url=String(input);if(!url.startsWith('https://account-test.supabase.co'))return oldFetch(input,options);
  const token=options.headers.Authorization?.replace('Bearer ','');const uid=token==='token-a'?a:token==='token-b'?b:null;
  if(url.endsWith('/auth/v1/user'))return Response.json(uid?{id:uid,email_confirmed_at:'2026-01-01'}:{},{status:uid?200:401});
  if(!uid)return Response.json({},{status:401});
  if(url.includes('/rest/v1/moro_account_state')){assert(url.includes(uid));return Response.json(rows.has(uid)?[rows.get(uid)]:[]);}
  if(url.endsWith('/rpc/moro_save_state')){
   if(failWrite)return Response.json({code:'42501'},{status:403});const payload=JSON.parse(options.body),old=rows.get(uid);if((old?.revision||0)!==payload.expected_revision)return Response.json({code:'40001'},{status:409});const value={state:payload.new_state,revision:(old?.revision||0)+1};rows.set(uid,value);return Response.json(value.revision);
  }throw Error('Unexpected URL');
 }) as typeof fetch;
 try{
  const app=express();app.use(express.json());registerAccountAuth(app);
  app.get('/api/profiles',(_req,res)=>res.json({profiles:db.getProfiles()}));
  app.get('/api/web-sources/home/top10',(_req,res)=>res.json({profiles:db.getProfiles()}));
  app.get('/api/web-sources/catalog',(_req,res)=>res.json({profiles:db.getProfiles()}));
  app.get('/api/profiles/:id/favorites',(req,res)=>res.json({favorites:db.getFavorites(req.params.id)}));
  app.post('/api/profiles/:id/favorites',(req,res)=>{db.addFavorite(req.params.id,'w32:movie:1');res.json({success:true});});
  server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
  const request=(path:string,token?:string,method='GET')=>oldFetch(base+path,{method,headers:token?{Authorization:'Bearer '+token}:{}});
  const guest=await (await request('/api/profiles')).json();assert.equal(guest.guest,true);assert.equal(rows.size,0);const publicCatalog=await (await request('/api/web-sources/catalog?profileId=moro-guest')).json();assert.equal(publicCatalog.profiles[0].id,'moro-guest');assert.equal((await request('/api/web-sources/catalog?profileId=private-profile')).status,401);assert.equal((await request('/api/profiles/moro-guest/favorites',undefined,'POST')).status,401);assert.equal((await request('/api/profiles','fake')).status,401);
  assert.equal((await request('/api/web-sources/home/top10?profileId=moro-guest')).status,200);assert.equal((await request('/api/web-sources/home/top10?profileId=private-profile')).status,401);assert.equal(rows.size,0);
  const pa=await (await request('/api/profiles','token-a')).json(),pb=await (await request('/api/profiles','token-b')).json();const id1=pa.profiles[0].id,id2=pb.profiles[0].id;assert.notEqual(id1,id2);assert.equal(rows.size,2);
  assert.equal((await request(`/api/profiles/${id1}/favorites`,'token-b')).status,404);
  assert.equal((await request(`/api/profiles/${id1}/favorites`,'token-a','POST')).status,200);assert.deepEqual(rows.get(a).state.favorites,[[id1,['w32:movie:1']]]);assert.deepEqual(rows.get(b).state.favorites,[]);
  failWrite=true;assert.equal((await request(`/api/profiles/${id2}/favorites`,'token-b','POST')).status,503);assert.deepEqual(rows.get(b).state.favorites,[]);failWrite=false;
  const simultaneous=await Promise.all([request(`/api/profiles/${id1}/favorites`,'token-a','POST'),request(`/api/profiles/${id1}/favorites`,'token-a','POST')]);assert(simultaneous.some(r=>r.status===200));assert(simultaneous.every(r=>[200,409].includes(r.status)));
 }finally{global.fetch=oldFetch;if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.SUPABASE_PUBLISHABLE_KEY;else process.env.SUPABASE_PUBLISHABLE_KEY=oldKey;if(server)await new Promise<void>(r=>server.close(()=>r()));}
});
