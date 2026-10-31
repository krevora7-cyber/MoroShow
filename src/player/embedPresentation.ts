export function embedStartUrl(url:string,resumeTime?:number){
 const parsed=new URL(url);
 if(parsed.origin==='https://vidlink.pro'&&Number.isFinite(resumeTime)&&resumeTime!>0)parsed.searchParams.set('startAt',String(Math.floor(resumeTime!)));
 return parsed.href;
}
export function orderEmbedVariants<T extends {id:string}>(variants:readonly T[],ios:boolean):T[]{
 const order=['cinezo','vidsrc-mov','vidlink','vidsrc-sh'];
 return [...variants].sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
}
// All selected servers render inside the app. External playback is never forced.
export function needsPlayerWindow(_url:string,_ios:boolean){return false;}
