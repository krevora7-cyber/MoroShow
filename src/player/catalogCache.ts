import {apiFetch} from './netshowApi';
const memory=new Map<string,{until:number;data:any}>(),pending=new Map<string,Promise<any>>();
// Profile ID and Kids mode must be part of every cache key. Never persist stream URLs.
export async function catalogJson(path:string,persist=false):Promise<any>{
 const now=Date.now();let hit=memory.get(path);
 if(!hit&&persist){try{hit=JSON.parse(sessionStorage.getItem('moro-catalog:499:'+path)||'null');}catch{}}
 if(hit&&hit.until>now)return hit.data;
 if(!pending.has(path))pending.set(path,(async()=>{
 const r=await apiFetch(path,{signal:AbortSignal.timeout(30000)});const data=await r.json();
 if(!r.ok||!data.success)throw new Error(data.error||'Catalog could not be loaded.');
 const entry={data,until:Date.now()+180000};if(memory.size>=80)memory.delete(memory.keys().next().value!);memory.set(path,entry);
 if(persist)try{sessionStorage.setItem('moro-catalog:499:'+path,JSON.stringify(entry));}catch{}
 return data;
 })().finally(()=>pending.delete(path)));
 return pending.get(path)!;
}
