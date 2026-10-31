import {sourceFromDescriptor} from './dramaPlayback';
import {load} from 'cheerio';
import type {CatalogItem} from '../types';
const origin='https://dramatip.net';
const cache=new Map<string,{expires:number;html:string}>(),pending=new Map<string,Promise<string>>();
async function html(path:string){const hit=cache.get(path);if(hit&&hit.expires>Date.now())return hit.html;if(!pending.has(path))pending.set(path,(async()=>{const r=await fetch(origin+path,{redirect:'error',headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html'},signal:AbortSignal.timeout(25000)});if(!r.ok)throw new Error(`DramaTip returned HTTP ${r.status}`);const h=await r.text();if(h.length>5000000)throw new Error('DramaTip response is too large');if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(path,{html:h,expires:Date.now()+180000});return h;})().finally(()=>pending.delete(path)));return pending.get(path)!;}
function picture(raw:string|undefined){if(!raw)return undefined;try{const u=new URL(raw||'',origin);if(u.protocol!=='https:')return undefined;if(u.searchParams.has('w'))u.searchParams.set('w','500');return u.href;}catch{return undefined;}}
function item(slug:string,name:string,image?:string):CatalogItem{return {id:'drama:'+slug,name,seriesTitle:name,kind:'series',category:'Short dramas',streamUrl:'',streamType:'hls',isKidFriendly:false,logoUrl:picture(image),backdropUrl:picture(image)};}
export function parseDramaCatalog(h:string){const $=load(h),items=new Map<string,CatalogItem>();$('a[href]').each((_,el)=>{const a=$(el);let u:URL;try{u=new URL(a.attr('href')||'',origin);}catch{return;}const m=/^\/series\/([a-zA-Z0-9_-]+)$/.exec(u.pathname);const image=a.find('img').first(),name=image.attr('alt')||a.find('h2,h3').first().text();if(m&&u.origin===origin&&image.length&&name.trim())items.set(m[1],item(m[1],name.trim(),image.attr('src')));});return [...items.values()];}
export async function dramaCatalog(page:number,category:string,q:string){if(!/^[a-z0-9-]+$/.test(category))throw new Error('Invalid category');const path=q?'/search?'+new URLSearchParams({q,page:String(page)}):`/category/${category}${page>1?'/page/'+page:''}`;const h=await html(path),$=load(h);const next=q?`page=${page+1}`:`/page/${page+1}`;const hasMore=$('a[href]').toArray().some(a=>($(a).attr('href')||'').includes(next));return {items:parseDramaCatalog(h),page,hasMore};}
export function parseDramaDetails(h:string,slug:string){const $=load(h);let meta:any={};$('script[type="application/ld+json"]').each((_,el)=>{try{const d=JSON.parse($(el).text()),nodes=d['@graph']||[d];const match=nodes.find((n:any)=>n['@type']==='TVSeries');if(match)meta=match;}catch{}});const parent=item(slug,meta.name||$('h1').first().text().trim()||slug,typeof meta.image==='string'?meta.image:$('meta[property="og:image"]').attr('content'));parent.overview=meta.description||$('meta[name="description"]').attr('content')||'';const episodes=new Map<number,CatalogItem>();$('a[href]').each((_,el)=>{const a=$(el),path=a.attr('href')||'',m=/^\/series\/([a-zA-Z0-9_-]+)\/episode-(\d+)$/.exec(path);if(!m||m[1]!==slug)return;const n=Number(m[2]);episodes.set(n,{...parent,id:`drama:${slug}:${n}`,name:`Episode ${n}`,season:1,episode:n});});return {item:parent,episodes:[...episodes.values()].sort((a,b)=>a.episode!-b.episode!)};}
export async function dramaDetails(id:string){const m=/^drama:([a-zA-Z0-9_-]+)$/.exec(id);if(!m)throw new Error('Invalid short drama');return parseDramaDetails(await html('/series/'+m[1]),m[1]);}
export function dramaEpisodeUrl(id:string){const m=/^drama:([a-zA-Z0-9_-]+):([1-9]\d*)$/.exec(id);if(!m)throw new Error('Select an episode');return `${origin}/series/${m[1]}/episode-${m[2]}`;}


function normalizedPayloads(h:string){
 const $=load(h),parts=[h];let flight='';
 $('script').each((_,el)=>{
  const script=$(el).text();parts.push(script);
  for(const m of script.matchAll(/self\.__next_f\.push\(\s*\[\s*1\s*,\s*("(?:\\.|[^"\\])*")\s*\]\s*\)/g)){
   try{flight+=JSON.parse(m[1]);}catch{}
  }
 });
 if(flight)parts.push(flight);
 // Serialized Next.js props may be quoted inside JavaScript strings.
 const plain=parts.join('\n').replace(/\\u0022/g,'"').replace(/&quot;/g,'"').replace(/\\"/g,'"');
 return {plain,flight,parts};
}
export function parseDramaBookId(h:string,slug?:string):string{
 const {plain,flight,parts}=normalizedPayloads(h);
 const internal=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{24}$/i.test(v);
 // Match the current series object, rather than a recommended series or its provider's bookId.
 const scoped:string[]=[];
 function visit(v:any,depth=0){
  if(!v||typeof v!=='object'||depth>60)return;
  if(slug&&(v.slug===slug||v.book?.slug===slug)){
   const book=v.slug===slug?v:v.book;
   const id=[book._id,book.id,book.bookId,v.bookId].find(internal);if(id)scoped.push(id);
  }
  for(const child of Object.values(v))if(child&&typeof child==='object')visit(child,depth+1);
 }
 for(const line of flight.split('\n')){const colon=line.indexOf(':');if(colon>=0)try{visit(JSON.parse(line.slice(colon+1)));}catch{}}
 for(const part of parts)try{visit(JSON.parse(part));}catch{}
 const matches=[...plain.matchAll(/["']?bookId["']?\s*:\s*["']([a-zA-Z0-9_-]+)["']/g)].map(m=>m[1]);
 const preferred=[...new Set(scoped.length?scoped:matches.filter(internal))];
 if(preferred.length===1)return preferred[0];
 if(preferred.length>1)throw new Error('CLIPS_ID_AMBIGUOUS: More than one DramaTip series ID was found.');
 const legacy=[...new Set(matches)];
 if(legacy.length===1)return legacy[0];
 throw new Error('CLIPS_ID_MISSING: The current DramaTip series identifier could not be read.');
}
function initialDescriptor(h:string,episode:number):any|null{
 const field=episode===1?'sourceFirst':episode===2?'nextSourceFirst':null;if(!field)return null;
 const {plain}=normalizedPayloads(h),m=new RegExp('"'+field+'"\\s*:\\s*\\{').exec(plain);if(!m)return null;
 const begin=plain.indexOf('{',m.index);let depth=0,string=false,escape=false;
 for(let i=begin;i<plain.length&&i-begin<100000;i++){
  const ch=plain[i];if(string){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch==='"')string=false;continue;}
  if(ch==='"')string=true;else if(ch==='{')depth++;else if(ch==='}'&&--depth===0){try{
   const value=JSON.parse(plain.slice(begin,i+1));
   return value.descriptor?value:value.chain?{descriptor:value}:value.enc?{descriptor:{chain:[value]}}:null;
  }catch{return null;}}
 }
 return null;
}
export async function resolveDramaEpisodeSource(id:string){
 const m=/^drama:([a-zA-Z0-9_-]+):([1-9]\d*)$/.exec(id);if(!m)throw new Error('Select an episode');
 const page=await html('/series/'+m[1]),bookId=parseDramaBookId(page,m[1]);
 const requestedLanguage=/^[a-z]{2}(?:-[A-Z]{2})?$/.test(process.env.DRAMATIP_LANGUAGE||'')?process.env.DRAMATIP_LANGUAGE!:'ar';
 const pageLanguage=/\blang=["']([a-z]{2}(?:-[A-Z]{2})?)["']/i.exec(page)?.[1]||'en';
 const languages=[...new Set([requestedLanguage,pageLanguage])];
 let nullResponses=0;
 for(const language of languages){
  const url=origin+`/api/episode-source/${encodeURIComponent(bookId)}/${m[2]}?lang=${encodeURIComponent(language)}&refresh=1`;
  const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{'User-Agent':'Mozilla/5.0',Accept:'application/json',Referer:origin+'/series/'+m[1]}});
  if(!r.ok)throw new Error(`CLIPS_API_HTTP: DramaTip episode API returned HTTP ${r.status}.`);
  const data=await r.json();
  // A null descriptor is not a decryption error. Try the page language, never switch episodes or titles.
  if(!data?.descriptor){nullResponses++;continue;}
  const urlValue=await sourceFromDescriptor(data);
  return {url:urlValue,language,requestedLanguage,note:language!==requestedLanguage?`No ${requestedLanguage} source was returned. Using the ${language} catalog source; audio and subtitles depend on the video.`:undefined};
 }
 const inline=initialDescriptor(page,Number(m[2]));
 if(inline){return {url:await sourceFromDescriptor(inline),language:pageLanguage,requestedLanguage,note:`Using the source supplied on the ${pageLanguage} episode page. Audio and subtitles depend on the video.`};}
 throw new Error(`CLIPS_DESCRIPTOR_NULL: DramaTip returned no episode source (ID ${bookId}, episode ${m[2]}, languages ${languages.join(', ')}; ${nullResponses} empty responses).`);
}
export async function resolveDramaEpisode(id:string){return (await resolveDramaEpisodeSource(id)).url;}
