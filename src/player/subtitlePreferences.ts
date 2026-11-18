export function readSubtitlePreference(profileId?:string){try{return localStorage.getItem('moroshow-subtitles:'+profileId)||'off';}catch{return 'off';}}
export function saveSubtitlePreference(profileId:string|undefined,language:string){try{localStorage.setItem('moroshow-subtitles:'+profileId,language);}catch{}}
export function matchingSubtitle(language:string,tracks:{lang:string}[]){
 const base=(code:string)=>{const value=code.toLowerCase().split('-')[0];return ({ara:'ar',eng:'en',fre:'fr',fra:'fr'} as Record<string,string>)[value]||value;};
 if(language==='off')return 'off';
 return tracks.find(t=>t.lang.toLowerCase()===language.toLowerCase())?.lang||tracks.find(t=>base(t.lang)===base(language))?.lang||'off';
}
