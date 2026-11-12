export function embedStartUrl(url:string,resumeTime?:number){
 const parsed=new URL(url);
 if(parsed.origin==='https://cinesrc.st'&&Number.isFinite(resumeTime)&&resumeTime!>0)parsed.searchParams.set('t',String(Math.floor(resumeTime!)));
 if(parsed.origin==='https://mapple.fun'&&Number.isFinite(resumeTime)&&resumeTime!>0)parsed.searchParams.set('startAt',String(Math.floor(resumeTime!)));
 if(parsed.origin==='https://vidstuck.cc'&&Number.isFinite(resumeTime)&&resumeTime!>0)parsed.searchParams.set('progress',String(Math.floor(resumeTime!)));
 if(parsed.origin==='https://vidlink.pro'&&Number.isFinite(resumeTime)&&resumeTime!>0)parsed.searchParams.set('startAt',String(Math.floor(resumeTime!)));
 return parsed.href;
}
export function orderEmbedVariants<T extends {id:string}>(variants:readonly T[],ios:boolean):T[]{
 const order=['cinesrc','vidstuck','videasy','vidlink','cinezo','vidsrc-mov','vidsrc-sh'];
 return [...variants].sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
}
export const PRIMARY_MOVIE_SOURCE_ID = 'cinesrc';

export function numberMovieSources(variants: readonly {id:string}[]) {
 return [...variants]
   .sort((a, b) => Number(b.id === PRIMARY_MOVIE_SOURCE_ID) - Number(a.id === PRIMARY_MOVIE_SOURCE_ID))
   .map(({id}, index) => ({id, label: `Source ${index + 1}`}));
}
// All selected servers render inside the app. External playback is never forced.
export function needsPlayerWindow(_url:string,_ios:boolean){return false;}
