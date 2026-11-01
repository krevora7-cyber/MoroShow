import type {Express,Request,Response,NextFunction} from 'express';
import {NetShowDatabase,withAccountDatabase} from './db';
export function registerAccountAuth(app:Express){
 const url=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');const key=String(process.env.SUPABASE_PUBLISHABLE_KEY||'');
 const enabled=!!(url&&key);
 app.get('/api/auth/config',(_req,res)=>res.json({enabled}));
 if(!enabled)return;
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))throw new Error('Invalid SUPABASE_URL');
 app.use('/api',async(req:Request,res:Response,next:NextFunction)=>{
  // Native media elements cannot attach Authorization headers. These endpoints
  // already require short-lived, unguessable playback capabilities.
  if(req.method==='GET'&&(/^\/live\/media\/[a-f0-9]+$/.test(req.path)||/^\/clips\/media\/[a-f0-9]+$/.test(req.path)||/^\/shorts\/key\/[a-f0-9]+$/.test(req.path)||/^\/shorts\/compatible\/[a-f0-9]{48}\/[\w.-]+$/.test(req.path)))return next();
  const token=req.headers.authorization?.match(/^Bearer ([^\s]+)$/)?.[1];
  if(!token){
   const guest={id:'moro-guest',name:'Guest',avatar:'disney_01',isKid:false,hasPin:false,createdAt:0};
   if(req.method==='GET'&&req.path==='/profiles')return res.json({success:true,guest:true,profiles:[guest]});
   const requested=req.path.match(/^\/profiles\/([^/]+)/)?.[1]||String(req.query.profileId||req.body?.profileId||'');
   if(requested&&requested!==guest.id)return res.status(401).json({success:false,error:'Sign in to use this profile.'});
   if(req.method==='GET'&&req.path===`/profiles/${guest.id}/history`)return res.json({success:true,history:[]});
   if(req.method==='GET'&&req.path===`/profiles/${guest.id}/favorites`)return res.json({success:true,favorites:[]});
   const publicRead=req.method==='GET'&&(/^\/web-sources\/(status|catalog|anime|clips|hero\/netflix|home\/(?:top10|[a-z-]+))$/.test(req.path)||/^\/media\/[^/]+\/artwork$/.test(req.path)||/^\/series\/[^/]+\/episodes$/.test(req.path)||req.path==='/live/channels'||req.path==='/shorts/subtitles');
   const publicPlay=req.method==='POST'&&['/stream/token','/live/play'].includes(req.path);
   if(publicRead||publicPlay)return withAccountDatabase(new NetShowDatabase({profiles:[guest],history:[],favorites:[]}),()=>next());
   return res.status(401).json({success:false,error:'Sign in to save titles and manage your account.'});
  }
  const headers={apikey:key,Authorization:`Bearer ${token}`};
  try{
   const auth=await fetch(`${url}/auth/v1/user`,{headers,signal:AbortSignal.timeout(10000)});
   if(auth.status===401||auth.status===403)return res.status(401).json({success:false,error:'Session expired. Sign in again.'});
   if(!auth.ok)throw Error('Authentication service unavailable.');
   const user=await auth.json();
   if(!/^[a-f0-9-]{36}$/.test(String(user.id))||!user.email_confirmed_at)return res.status(401).json({success:false,error:'Confirm your email before signing in.'});
   const row=await fetch(`${url}/rest/v1/moro_account_state?account_id=eq.${user.id}&select=state,revision`,{headers,signal:AbortSignal.timeout(10000)});
   if(!row.ok)throw Error('Account storage is not ready. Apply the MoroShow Supabase migration.');
   const rows=await row.json();const saved=rows[0];const database=new NetShowDatabase(saved?.state||null);const revision=saved?.revision||0;
   const profileId=req.path.match(/^\/profiles\/([^/]+)/)?.[1]||String(req.query.profileId||req.body?.profileId||'');
   if(profileId&&!database.getProfileById(profileId))return res.status(404).json({success:false,error:'Profile not found in this account.'});
   const json=res.json.bind(res);let sending=false;
   res.json=((body:unknown)=>{
    if(sending)return res; sending=true;
    void (async()=>{
     if(database.changed&&res.statusCode<400){
      const write=await fetch(`${url}/rest/v1/rpc/moro_save_state`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({expected_revision:revision,new_state:database.exportAccountState()}),signal:AbortSignal.timeout(10000)});
      if(!write.ok){const error=await write.json().catch(()=>({}));if(error.code==='40001'){res.status(409);return json({success:false,error:'Account changed on another device. Retry.'});}throw Error('Account changes could not be saved. Retry.');}
     }
     return json(body);
    })().catch(()=>{if(!res.headersSent){res.status(503);json({success:false,error:'Account changes could not be saved. Retry.'});}});
    return res;
   }) as typeof res.json;
   withAccountDatabase(database,()=>next());
  }catch(e){return res.status(503).json({success:false,error:e instanceof Error?e.message:'Account service unavailable.'});}
 });
}
