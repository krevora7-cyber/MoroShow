import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const child=spawn(process.execPath,['--import','tsx','server.ts'],{env:{...process.env,NODE_ENV:'production',PORT:'3199',NODE_USE_ENV_PROXY:'1'},stdio:['ignore','pipe','pipe']});
const result={version:'4.9.0',backend:false,movieCatalog:null,liveVideoVerified:false,uiBrowserVerified:false};
try{
 await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Startup timeout')),20000);child.stdout.on('data',v=>{if(String(v).includes('Ready')){clearTimeout(t);resolve();}});child.once('exit',c=>{clearTimeout(t);reject(Error('Server exited '+c));});});
 const base='http://127.0.0.1:3199';
 const profiles=await fetch(base+'/api/profiles').then(r=>r.json());result.backend=true;
 const p=profiles.profiles.find(x=>!x.isKid);const start=Date.now();
 try{const r=await fetch(base+`/api/web-sources/catalog?type=movie&profileId=${p.id}`,{signal:AbortSignal.timeout(22000)});const d=await r.json();result.movieCatalog={success:d.success,count:d.items?.length||0,ms:Date.now()-start,...(!d.success?{error:d.error}:{})};}catch(e){result.movieCatalog={success:false,error:e.message};}
 console.log(JSON.stringify(result,null,2));writeFileSync('verification/verification-49.json',JSON.stringify(result,null,2)+'\n');
}finally{child.kill('SIGTERM');}
