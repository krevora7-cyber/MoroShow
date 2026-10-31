export function readSubtitlePreference(profileId?:string){try{return localStorage.getItem('moroshow-subtitles:'+profileId)||'off';}catch{return 'off';}}
export function saveSubtitlePreference(profileId:string|undefined,language:string){try{localStorage.setItem('moroshow-subtitles:'+profileId,language);}catch{}}
export function matchingSubtitle(language:string,tracks:{lang:string}[]){if(language==='off')return 'off';return tracks.find(t=>t.lang.toLowerCase()===language.toLowerCase())?.lang||tracks.find(t=>t.lang.split('-')[0]===language.split('-')[0])?.lang||'off';}
