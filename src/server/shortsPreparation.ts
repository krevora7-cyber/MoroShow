import {resolveDramaEpisodeSource} from './dramaSource';
import {mediaLease} from './dramaPlayback';
import {needsVideoCompatibility} from './shortsCompatibility';
// Prefetch only the next episode's source and codec probe, never start a transcoder.
export function preparationCache<T>(prepare:(id:string,port:number)=>Promise<T>,ttl=60000){
 const ready=new Map<string,{at:number;value:T}>(),pending=new Map<string,Promise<T>>();
 return async(id:string,port:number,prefetch=false)=>{const key=port+':'+id,hit=ready.get(key);if(hit&&Date.now()-hit.at<ttl){if(!prefetch)ready.delete(key);return hit.value;}ready.delete(key);
 if(prefetch&&!pending.has(key)&&pending.size>=2)return undefined;
 if(!pending.has(key))pending.set(key,prepare(id,port).then(value=>{if(ready.size>=50)ready.delete(ready.keys().next().value!);ready.set(key,{at:Date.now(),value});return value;}).finally(()=>pending.delete(key)));
 const value=await pending.get(key)!;if(!prefetch)ready.delete(key);return value;
 };
}
export const prepareShort=preparationCache(async(id:string,port:number)=>{const source=await resolveDramaEpisodeSource(id),lease=mediaLease(source.url),local='http://127.0.0.1:'+port+lease,compatible=await needsVideoCompatibility(local);return {source,lease,local,compatible};});
