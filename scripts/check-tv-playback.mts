/** Live verification: tests catalogue, automatic source selection, local relay,
 * and FFmpeg video decoding. Does not claim native Safari/device verification. */
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import express from 'express';
import {providerJson,publicChannel,chooseWorkingChannel,lease,registerGeilTv} from '../src/server/geilTv';
const app=express();app.use(express.json());registerGeilTv(app);
const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
const base='http://127.0.0.1:'+(server.address()as any).port;
const decode=(url:string)=>new Promise<{decoded:boolean;reason?:string}>(resolve=>{
 const child=spawn(process.env.FFMPEG_PATH||'ffmpeg',['-v','error','-rw_timeout','15000000','-i',url,'-map','0:v:0','-frames:v','5','-f','null','-'],{stdio:['ignore','ignore','pipe']});
 let settled=false;const finish=(r:any)=>{if(settled)return;settled=true;clearTimeout(t);resolve(r);};
 const t=setTimeout(()=>{child.kill('SIGKILL');finish({decoded:false,reason:'decode_timeout'});},25000);
 child.stderr.resume();child.on('error',()=>finish({decoded:false,reason:'decoder_unavailable'}));child.on('exit',code=>finish(code===0?{decoded:true}:{decoded:false,reason:'decode_failed'}));
});
const results:any[]=[];
const requested=(process.env.TV_CHECK_IDS||'').split(',').filter(Boolean);
try{
 const data=await providerJson('/catalog/live/channels.json?search=bein&filter%5Bgroup%5D=Arabia&sort=name');
 for(const c of data.items||[])publicChannel(c);
 const candidates=(data.items||[]).filter((c:any)=>/^BEIN SPORTS [1-9] HD \(1\)$/i.test(c.name)&&(!requested.length||requested.includes(String(c.id))));
 for(let i=0;i<candidates.length;i+=1){await Promise.all(candidates.slice(i,i+1).map(async(c:any)=>{
  const at=Date.now();let r:any={channel:c.name,id:String(c.id)};
  try{const pick=await chooseWorkingChannel(String(c.id),[],AbortSignal.timeout(65000));r={...r,selectedSourceId:pick.sourceId,attemptedIds:pick.attemptedIds,manifestAndSegment:true,...await decode(base+lease(pick.data.url))};}catch{r={...r,manifestAndSegment:false,decoded:false,reason:'no_reachable_source'};}
  r.seconds=Math.round((Date.now()-at)/1000);results.push(r);console.log(JSON.stringify(r));fs.mkdirSync('verification',{recursive:true});fs.writeFileSync('verification/tv-live-followup-4121.json',JSON.stringify({checkedAt:new Date().toISOString(),nativeIPhoneTested:false,results},null,2));
 }));}
 fs.mkdirSync('verification',{recursive:true});fs.writeFileSync('verification/'+(requested.length?'tv-live-followup-4121.json':'tv-live-4121.json'),JSON.stringify({checkedAt:new Date().toISOString(),nativeIPhoneTested:false,scope:'Arabic beIN Sports 1–9 HD entries present on provider first page; five decoded frames via application relay, not continuous uptime.',results},null,2));
}finally{server.closeAllConnections();server.close();}
