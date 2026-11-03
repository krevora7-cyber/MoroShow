import {apiFetch} from './netshowApi';
type Entry={until:number;data:any};
const memory=new Map<string,Entry>(),pending=new Map<string,Promise<any>>();
export function catalogKey(path:string){const u=new URL(path,'https://cache.invalid');for(const [k,v] of [...u.searchParams])if(v===''||k==='retry'&&v==='0')u.searchParams.delete(k);if(u.pathname==='/api/web-sources/catalog'){u.searchParams.delete('category');u.searchParams.delete('lang');if(u.searchParams.get('page')==='1')u.searchParams.delete('page');}u.searchParams.sort();return u.pathname+'?'+u.searchParams;}
// Only catalog metadata is cached; keys retain profile, Kids mode, and filters.
export async function catalogJson(path:string,persist=false):Promise<any>{
 const key=catalogKey(path),now=Date.now(),retry=new URL(path,'https://cache.invalid').searchParams.has('retry');let hit=memory.get(key);
 if(!hit&&persist){try{hit=JSON.parse(sessionStorage.getItem('moro-catalog:500:'+key)||'null');}catch{}}
 if(!retry&&hit&&hit.until>now)return hit.data;
 const refresh=()=>{if(!pending.has(key))pending.set(key,(async()=>{const r=await apiFetch(path,{signal:AbortSignal.timeout(30000)});const data=await r.json();if(!r.ok||!data.success)throw new Error(data.error||'Catalog could not be loaded.');const entry={data,until:Date.now()+180000};if(memory.size>=80)memory.delete(memory.keys().next().value!);memory.set(key,entry);if(persist)try{sessionStorage.setItem('moro-catalog:500:'+key,JSON.stringify(entry));}catch{}return data;})().finally(()=>pending.delete(key)));return pending.get(key)!;};
 if(!retry&&hit&&hit.until+1800000>now){void refresh().catch(()=>{});return hit.data;}return refresh();
}
