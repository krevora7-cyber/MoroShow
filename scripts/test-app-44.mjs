import {writeFileSync} from 'node:fs';
process.env.PORT='3110';process.env.NODE_ENV='production';process.env.NETSHOW_CATALOG_PER_SOURCE='2';
await import('../server.ts');
const root='http://127.0.0.1:3110';const report={at:new Date().toISOString(),scope:'real server endpoints; small catalog sample per source; no media credentials forwarded by this check'};
try{
 let data;
 for(let i=0;i<90;i++){
  await new Promise(r=>setTimeout(r,1500));
  try{data=await(await fetch(root+'/api/catalog?compact=1')).json();if(data.items?.some(x=>x.kind==='movie')&&data.items?.some(x=>x.kind==='series'))break;}catch{}
 }
 report.version=await(await fetch(root+'/api/version')).json();
 report.catalog={count:data?.items?.length||0,hasCompactArrays:!('movies' in data),loading:data?.loading};
 const profile=(await(await fetch(root+'/api/profiles')).json()).profiles.find(x=>!x.isKid);
 const series=data?.items?.find(x=>x.kind==='series');
 if(series){const r=await fetch(root+'/api/series/'+encodeURIComponent(series.id)+'/episodes?profileId='+profile.id);const d=await r.json();report.episodes={http:r.status,count:d.episodes?.length||0};}
 report.sources=await(await fetch(root+'/api/providers')).json();
 const home=await(await fetch(root)).text();report.uiBuild=home.includes('MoroShow');
}catch(e){report.error=e.message;}
writeFileSync('verification/app-44.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));process.exit(report.error?1:0);
