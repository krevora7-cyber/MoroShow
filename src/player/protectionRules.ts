export const RULES_URL='https://moro-show.vercel.app/playback-blocklist.json';
export const BUNDLED_RULES={version:1,hosts:['doubleclick.net','googlesyndication.com','googleadservices.com','adsterra.com','adsterra.net','popads.net','popcash.net','propellerads.com','onclickads.net','onclkds.com','exoclick.com','exosrv.com','trafficjunky.net','juicyads.com','adnxs.com','adskeeper.com','mgid.com','hilltopads.net','clickadu.com','clickaine.com']};
const reserved=['cinesrc.st','mapple.fun','vidup.to','cinezo.live','vidsrc.mov','vidlink.pro','vidsrc.sh','dramatip.net','vercel.app','supabase.co','themoviedb.org','tmdb.org','trycloudflare.com','localhost'];
export type ProtectionRules={version:number;hosts:string[]};
export function validateRules(value:unknown):ProtectionRules|null{
 const x=value as ProtectionRules;if(!x||!Number.isSafeInteger(x.version)||x.version<1||!Array.isArray(x.hosts)||!x.hosts.length||x.hosts.length>2000)return null;
 const hosts=new Set<string>();for(const host of x.hosts){if(typeof host!=='string'||host.length>253||!/^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)||reserved.some(r=>r===host||r.endsWith('.'+host)||host.endsWith('.'+r)))return null;hosts.add(host);}return {version:x.version,hosts:[...hosts]};
}
const cacheKey='moro-playback-rules-v1';
// Only domain data is downloaded, never executable rules or arbitrary update URLs.
export async function loadProtectionRules(force=false,storage:Pick<Storage,'getItem'|'setItem'>=localStorage,request:typeof fetch=fetch):Promise<{rules:ProtectionRules;updated:boolean}>{
 let rules:ProtectionRules=BUNDLED_RULES,lastCheck=0;
 try{const cached=JSON.parse(storage.getItem(cacheKey)||'null');const valid=validateRules(cached?.rules);if(valid&&valid.version>=rules.version){rules=valid;lastCheck=Number(cached.checkedAt)||0;}}catch{}
 if(!force&&lastCheck<=Date.now()&&Date.now()-lastCheck<86400000)return {rules,updated:false};
 try{const response=await request(RULES_URL,{redirect:'error',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('Rules update unavailable');const text=await response.text();if(text.length>150000)throw Error('Rules list too large');const next=validateRules(JSON.parse(text));if(!next||next.version<rules.version)throw Error('Invalid rules update');rules=next;try{storage.setItem(cacheKey,JSON.stringify({rules,checkedAt:Date.now()}));}catch{}return {rules,updated:true};}catch{return {rules,updated:false};}
}
export function protectionEnabled(){try{return localStorage.getItem('moro-player-protection')!=='off';}catch{return true;}}

