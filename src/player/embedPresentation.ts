export function embedStartUrl(url:string,resumeTime?:number){
 const parsed=new URL(url);
 if(parsed.origin==='https://vidstuck.cc'&&Number.isFinite(resumeTime)&&resumeTime!>0)parsed.searchParams.set('progress',String(Math.floor(resumeTime!)));
 if(parsed.origin==='https://vidlink.pro'&&Number.isFinite(resumeTime)&&resumeTime!>0)parsed.searchParams.set('startAt',String(Math.floor(resumeTime!)));
 return parsed.href;
}
export function orderEmbedVariants<T extends {id:string}>(variants:readonly T[],ios:boolean):T[]{
 const order=['cinesrc','vidstuck','videasy','vidlink','cinezo','vidsrc-mov','vidsrc-sh'];
 const rank = (id:string) => {
   const index = order.indexOf(id);
   return index < 0 ? order.length : index;
 };
 // Older playback APIs can still advertise the retired source.
 return variants.filter(variant=>variant.id!=='moviebox').sort((a,b)=>rank(a.id)-rank(b.id));
}
// All selected servers render inside the app. External playback is never forced.
export function needsPlayerWindow(_url:string,_ios:boolean){return false;}
