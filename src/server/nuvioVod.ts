import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {realpath} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {directAddonStream} from './stremioVod';

const run = promisify(execFile);
const runner = fileURLToPath(new URL('../../scripts/read-nuvio-streams.cjs',import.meta.url));
const pending = new Map<string, Promise<ReturnType<typeof directAddonStream>>>();

export async function nuvioVod(provider:string, title:{id:number;type:'movie'|'tv';season?:number;episode?:number}) {
  const file = provider==='vidlink' ? process.env.MOROSHOW_VIDLINK_PLUGIN :
    provider==='vixsrc' ? process.env.MOROSHOW_VIXSRC_PLUGIN : undefined;
  if (!file || !isAbsolute(file)) return;
  const args = [String(title.id), title.type, String(title.season??''), String(title.episode??'')];
  const key = JSON.stringify([file,...args]);
  const existing = pending.get(key);
  if (existing) return existing;
  if (pending.size >= 4) return;
  const lookup = (async()=>{
    try {
      const bundle = await realpath(file);
      const {stdout} = await run(process.execPath, [
        '--permission','--max-old-space-size=96','--allow-fs-read='+runner,'--allow-fs-read='+bundle,
        runner,bundle,...args
      ],{env:{},timeout:7000,killSignal:'SIGKILL',maxBuffer:256*1024});
      return directAddonStream(JSON.parse(stdout));
    } catch { return undefined; }
  })();
  pending.set(key,lookup);
  try { return await lookup; } finally { pending.delete(key); }
}
