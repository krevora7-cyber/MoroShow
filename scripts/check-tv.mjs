import 'dotenv/config';
import {writeFileSync} from 'node:fs';
import {parseM3U} from '../src/utils/m3uParser.ts';
import {configFromM3u,loadXtreamTV} from '../src/server/xtream.ts';
const report={at:new Date().toISOString(),scope:'TV-only catalog; credentials redacted'};
try{const cfg=configFromM3u(process.env.NETSHOW_TV_M3U_URL);const data=await loadXtreamTV(cfg);report.channels=data.items.length;report.categories=new Set(data.items.map(x=>x.category)).size;report.result=data.items.length?'catalog received':'empty';report.warnings=data.warnings;}catch(e){report.result='failed';report.error=e.message;try{const r=await fetch(process.env.NETSHOW_TV_M3U_URL,{signal:AbortSignal.timeout(20000)});report.playlistHttp=r.status;const body=await r.text();report.playlistChannels=body.trimStart().startsWith('#EXTM3U')?parseM3U(body).items.filter(x=>x.kind==='live').length:0;}catch{report.playlistResult='network request failed';}}
writeFileSync('verification/tv-audit.json',JSON.stringify(report,null,2));console.log(report);
