// Real upstream integration probe. Requires .env; never logs profile or stream URLs.
import {writeFileSync} from 'node:fs';
process.env.PORT='3108';process.env.NODE_ENV='production';
await import('../server.ts');
const root='http://127.0.0.1:3108';
const report={at:new Date().toISOString(),checks:[]};
const get=async p=>(await fetch(root+p,{signal:AbortSignal.timeout(120000)})).json();
try{
 let data;
 for(let i=0;i<120;i++){
  await new Promise(r=>setTimeout(r,2000));
  try{data=await get('/api/catalog');if(data.items?.some(x=>x.category==='Cricify Events'))break;}catch{}
  if(i%10===0)console.log('Waiting for real catalog',i*2,'seconds', {count:data?.count,movies:data?.movies?.length,series:data?.series?.length,live:data?.items?.filter(x=>x.kind==='live').length});
 }
 if(!data?.count)throw Error('Real catalog did not load: '+JSON.stringify(await get('/api/source-status')));
 report.loading=Boolean(data.loading);report.catalog={movies:data.movies.length,series:data.series.length,events:data.items.filter(x=>x.category==='Cricify Events').length};console.log('CATALOG',report.catalog);
 const p=(await get('/api/profiles')).profiles.find(x=>!x.isKid);let episode;
 const show=null;
 if(show){const eps=await get('/api/series/'+encodeURIComponent(show.id)+'/episodes?profileId='+encodeURIComponent(p.id));report.episodes={show:show.name,count:eps.episodes?.length||0,error:eps.error};episode=eps.episodes?.[0];console.log('EPISODES',report.episodes);}
 for(const item of [data.items.find(x=>x.category==='Cricify Events'&&x.name.includes('🔴'))||data.items.find(x=>x.category==='Cricify Events')].filter(Boolean)){
  const row={name:item.name,kind:item.kind};
  try{
   const r=await fetch(root+'/api/stream/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contentId:item.id,profileId:p.id}),signal:AbortSignal.timeout(65000)});const b=await r.json();row.tokenStatus=r.status;row.type=b.streamType;row.servers=b.variants?.length||0;row.subtitles=b.subtitles?.length||0;
   if(b.subtitles?.length){const sub=await fetch(root+b.subtitles[0].url,{signal:AbortSignal.timeout(25000)});row.subtitleStatus=sub.status;row.subtitleVtt=(await sub.text()).startsWith('WEBVTT');}
   if(b.success){const v=await fetch(root+b.streamUrl,{headers:{Range:'bytes=0-65535'},signal:AbortSignal.timeout(30000)});row.mediaStatus=v.status;row.contentType=v.headers.get('content-type');const reader=v.body?.getReader();const c=await reader?.read();row.bytes=c?.value?.length||0;if(!v.ok&&c?.value)row.responseError=new TextDecoder().decode(c.value).slice(0,180);if(b.streamType==='hls'&&c?.value)row.hls=new TextDecoder().decode(c.value).includes('#EXTM3U');await reader?.cancel();
    if(row.hls&&c?.value){
     let body=new TextDecoder().decode(c.value);
     for(let depth=0;depth<3;depth++){
      const path=body.split(/\r?\n/).find(l=>l.trim()&&!l.startsWith('#'));
      if(!path||!path.startsWith('/api/stream/proxy?'))break;
      const part=await fetch(root+path.trim(),{signal:AbortSignal.timeout(20000)});
      row.childStatus=part.status;const pr=part.body.getReader();const chunk=await pr.read();await pr.cancel();
      const text=new TextDecoder().decode(chunk.value||new Uint8Array());
      if(!part.ok){row.childError=text.slice(0,100);break;}
      if(text.trimStart().startsWith('#EXTM3U')){body=text;continue;}
      row.mediaSegmentBytes=chunk.value?.length||0;break;
     }
    }
   }else row.error=b.error;
  }catch(e){row.error=e.message;}report.checks.push(row);console.log('PLAYBACK',row);
 }
}catch(e){report.error=e.message;console.log('ERROR',e.message);}
writeFileSync('verification/live-event-cnc.json',JSON.stringify(report,null,2));process.exit(report.error?1:0);
