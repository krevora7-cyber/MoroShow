import {spawn} from 'node:child_process';
import {mkdtempSync,existsSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import type {Express} from 'express';
const jobs=new Map<string,{dir:string;process:ReturnType<typeof spawn>;lastUse:number;failed:boolean;finished:boolean}>();
const binaries={ffmpeg:ffmpeg.path};
export async function needsVideoCompatibility(input:string){
 return new Promise<boolean>(resolve=>{let output='';const p=spawn(binaries.ffmpeg,['-hide_banner','-protocol_whitelist','file,http,tcp,crypto,data','-analyzeduration','3000000','-probesize','3000000','-i',input,'-t','0','-f','null','-'],{stdio:['ignore','ignore','pipe']});
 const timer=setTimeout(()=>{p.kill('SIGKILL');},12000);p.stderr?.on('data',b=>{if(output.length<100000)output+=b;});p.on('error',()=>{clearTimeout(timer);resolve(false)});p.on('close',()=>{clearTimeout(timer);const codec=/Stream[^\n]*Video: ([a-zA-Z0-9_]+)/.exec(output)?.[1];resolve(!!codec&&codec!=='h264');});});
}
export function compatibilityLease(input:string,workerLimit=2){
 // Input is constructed by the server from its own opaque media lease, never a client URL.
 const u=new URL(input);if(u.protocol!=='http:'||u.username||u.password||u.search||u.hash||u.hostname!=='127.0.0.1'||!/^\/api\/clips\/media\/[a-f0-9]{48}$/.test(u.pathname))throw Error('Invalid compatibility source');
 for(const [id,j]of jobs)if(Date.now()-j.lastUse>1800000){j.process.kill('SIGKILL');rmSync(j.dir,{recursive:true,force:true});jobs.delete(id);}
 while(jobs.size>=8){const old=[...jobs].find(([,j])=>j.finished);if(!old)break;rmSync(old[1].dir,{recursive:true,force:true});jobs.delete(old[0]);}
 if([...jobs.values()].filter(j=>!j.finished&&!j.failed).length>=Math.max(1,Math.min(8,Math.floor(workerLimit))))throw Error('Two videos are being prepared. Try again in a moment.');
 const id=randomBytes(24).toString('hex'),dir=mkdtempSync(join(tmpdir(),'moroshow-video-'));
 const p=spawn(binaries.ffmpeg,['-hide_banner','-loglevel','error','-protocol_whitelist','file,http,tcp,crypto,data','-i',input,'-map','0:v:0','-map','0:a:0?','-c:v','libx264','-preset','ultrafast','-crf','24','-pix_fmt','yuv420p','-vf','scale=trunc(min(720\\,iw)/2)*2:-2','-threads','2','-force_key_frames','expr:gte(t,n_forced*4)','-c:a','aac','-b:a','128k','-f','hls','-hls_time','4','-hls_list_size','0','-hls_playlist_type','event','-hls_flags','independent_segments+temp_file','-hls_segment_filename',join(dir,'segment-%05d.ts'),join(dir,'index.m3u8')],{stdio:['ignore','ignore','pipe']});
 const deadline=setTimeout(()=>p.kill('SIGKILL'),600000);deadline.unref();
 const job={dir,process:p,lastUse:Date.now(),failed:false,finished:false};jobs.set(id,job);p.stderr?.resume();p.on('error',()=>{job.failed=true;job.finished=true});p.on('close',code=>{clearTimeout(deadline);job.finished=true;job.failed=code!==0});
 return '/api/shorts/compatible/'+id+'/index.m3u8';
}
export function releaseCompatibility(path:string){const match=/^\/api\/shorts\/compatible\/([a-f0-9]{48})(?:\/index\.m3u8)?$/.exec(path);if(!match)return false;const job=jobs.get(match[1]);if(!job)return false;job.process.kill('SIGKILL');rmSync(job.dir,{recursive:true,force:true});jobs.delete(match[1]);return true;}
export function registerShortsCompatibility(app:Express){app.delete('/api/shorts/compatible/:id',(req,res)=>{if(!/^[a-f0-9]{48}$/.test(req.params.id))return res.sendStatus(404);releaseCompatibility('/api/shorts/compatible/'+req.params.id);res.sendStatus(204);});app.get('/api/shorts/compatible/:id/:file',async(req,res)=>{
 const j=jobs.get(req.params.id);if(!j)return res.status(410).send('Video expired. Retry.');if(!/^(index\.m3u8|segment-\d{5}\.ts)$/.test(req.params.file))return res.sendStatus(404);j.lastUse=Date.now();const file=join(j.dir,req.params.file),deadline=Date.now()+25000;
 while(!existsSync(file)&&!j.failed&&Date.now()<deadline&&!res.destroyed)await new Promise(r=>setTimeout(r,150));
 if(!existsSync(file))return res.status(j.failed?502:503).send('Video preparation unavailable. Retry.');res.setHeader('Cache-Control',req.params.file.endsWith('.m3u8')?'no-store':'private,max-age=120');res.type(req.params.file.endsWith('.m3u8')?'application/vnd.apple.mpegurl':'video/mp2t').send(readFileSync(file));
 });}
process.once('exit',()=>{for(const j of jobs.values()){j.process.kill('SIGKILL');rmSync(j.dir,{recursive:true,force:true})}});
