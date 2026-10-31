/**
 * Optional connector for a legitimate JSON API. No Android/Bridge required.
 * A real upstream provider must expose equivalent catalog/episodes/streams
 * endpoints, and license use of its content. This is NOT a CloudStream .cs3
 * interpreter or a bypass for subscription/DRM authentication.
 */
import type { ProviderAdapter,ProviderEntry,ProviderEpisode,ProviderId,ProviderStream } from './chromeProviderEngine.ts';
export function httpJsonProvider(id:ProviderId,origin:string,fetcher:typeof fetch=fetch):ProviderAdapter {
 const url=new URL(origin);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('Provider base must be a simple HTTP(S) origin');
 // Production APIs must use HTTPS; localhost HTTP is allowed only for tests/dev.
 if(url.protocol==='http:'&&!['localhost','127.0.0.1','::1'].includes(url.hostname))throw Error('Use HTTPS for a remote content API');
 async function readJSON<T>(path:string):Promise<T> {
   const r=await fetcher(new URL(path,url).toString(),{redirect:'error',signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'}});
   if(!r.ok)throw Error(`Content API returned ${r.status}`);
   const size=Number(r.headers.get('content-length')||0);if(size>2_000_000)throw Error('Content response too large');
   const raw=await r.text();if(raw.length>2_000_000)throw Error('Content response too large');
   return JSON.parse(raw) as T;
 }
 return {
   id,
   list:()=>readJSON<ProviderEntry[]>('/catalog'),
   episodes:(seriesId)=>readJSON<ProviderEpisode[]>('/series/'+encodeURIComponent(seriesId)+'/episodes'),
   streams:(contentId)=>readJSON<ProviderStream[]>('/stream/'+encodeURIComponent(contentId)),
 };
}
