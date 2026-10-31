import 'dotenv/config';
import fs from 'node:fs';
import express from 'express';
import {registerWebSources} from '../src/server/webSources.ts';
import {db} from '../src/server/db.ts';
import {dramaSeriesId} from '../src/server/dramaSource.ts';
const DRAMA_TEST_EPISODE={id:dramaSeriesId('نهوض-الزوج-العبقري','ar')+':21'};
const app=express();app.use(express.json());registerWebSources(app);
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base=`http://127.0.0.1:${server.address().port}`;
const report={checkedAt:new Date().toISOString(),series:'نهوض الزوج العبقري',episode:21};
try{
 const p=db.getProfiles().find(p=>!p.isKid);if(!p)throw new Error('No adult test profile');
 const catalog=await (await fetch(`${base}/api/web-sources/clips?profileId=${p.id}`)).json();report.shortCards=catalog.items.length;report.catalogAvailable=catalog.items.length>1;
 const token=await fetch(base+'/api/stream/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profileId:p.id,contentId:DRAMA_TEST_EPISODE.id,variantId:'dramatip'}),signal:AbortSignal.timeout(50000)}),s=await token.json();report.tokenStatus=token.status;report.streamType=s.streamType;if(!s.success)throw new Error(s.error);
 const r=await fetch(base+s.streamUrl,{headers:{Range:'bytes=0-1023'},signal:AbortSignal.timeout(20000)}),reader=r.body.getReader(),chunk=await reader.read();await reader.cancel();report.proxyStatus=r.status;report.contentType=r.headers.get('content-type');report.contentRange=r.headers.get('content-range');report.mp4Header=new TextDecoder().decode(chunk.value.slice(4,8))==='ftyp';report.subtitleTracks=s.subtitles?.length||0;const sub=s.subtitles?.find(t=>t.lang.startsWith('ar'));if(!sub)throw new Error('No Arabic subtitle track');const sr=await fetch(base+sub.url,{signal:AbortSignal.timeout(20000)}),vtt=await sr.text();report.subtitleStatus=sr.status;report.subtitleContentType=sr.headers.get('content-type');report.subtitleLanguage=sub.lang;report.subtitleLabel=sub.label;report.validWebVtt=vtt.startsWith('WEBVTT');report.subtitleCueCount=(vtt.match(/-->/g)||[]).length;report.hasArabicText=/[\u0600-\u06ff]/.test(vtt);report.passed=r.status===206&&report.mp4Header&&report.catalogAvailable&&sr.ok&&report.validWebVtt&&report.hasArabicText&&report.subtitleCueCount>0;
}catch(e){report.passed=false;report.error=e.message;}
fs.writeFileSync('verification/shorts-496.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));server.closeAllConnections();server.close();process.exit(report.passed?0:1);
