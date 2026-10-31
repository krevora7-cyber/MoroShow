type FullscreenVideo = HTMLVideoElement & {webkitEnterFullscreen?:()=>void;webkitSupportsFullscreen?:boolean;webkitDisplayingFullscreen?:boolean};
export function isIOSDevice(n:Pick<Navigator,'userAgent'|'platform'|'maxTouchPoints'>){return /iPad|iPhone|iPod/.test(n.userAgent)||(n.platform==='MacIntel'&&n.maxTouchPoints>1);}
// Call this directly in the click handler to retain Safari's user gesture.
export async function enterShortsFullscreen(video:FullscreenVideo,frame:HTMLElement,doc:Document,ios:boolean):Promise<'native'|'container'>{
 if(doc.fullscreenElement){await doc.exitFullscreen();return 'container';}
 if(ios&&video.webkitEnterFullscreen){video.webkitEnterFullscreen();return 'native';}
 if(frame.requestFullscreen){await frame.requestFullscreen();return 'container';}
 if(video.webkitEnterFullscreen){video.webkitEnterFullscreen();return 'native';}
 throw new Error('Fullscreen unavailable');
}
export function captionMode(enabled:boolean,language:string,native:boolean,selected='ar'):TextTrackMode{
 return enabled&&language.toLowerCase()===selected.toLowerCase()?(native?'showing':'hidden'):'disabled';
}
export function activeCaptionText(tracks:Iterable<TextTrack>,selected='ar'):string{
 const text=Array.from(tracks).filter(t=>t.mode!=='disabled'&&t.language.toLowerCase()===selected.toLowerCase()).flatMap(t=>Array.from(t.activeCues||[]).map(c=>{
 const cue=c as VTTCue;return typeof cue.getCueAsHTML==='function'?cue.getCueAsHTML().textContent||'':cue.text||'';
 }));return [...new Set(text)].join('\n');
}
export type CaptionCue={start:number;end:number;text:string};
export function parseCaptionCues(vtt:string):CaptionCue[]{
 const seconds=(value:string)=>value.split(':').reduce((sum,n)=>sum*60+Number(n),0);
 return vtt.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split(/\n\s*\n/).flatMap(block=>{
  const lines=block.split('\n'),index=lines.findIndex(line=>line.includes('-->'));if(index<0)return [];
  const match=/((?:\d+:)?\d{2}:\d{2}\.\d{3})\s*-->\s*((?:\d+:)?\d{2}:\d{2}\.\d{3})/.exec(lines[index]);if(!match)return [];
  const text=lines.slice(index+1).join('\n').replace(/<[^>]*>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').trim();
  return [{start:seconds(match[1]),end:seconds(match[2]),text}];
 });
}
export function captionAt(cues:CaptionCue[],time:number){return [...new Set(cues.filter(c=>time>=c.start&&time<c.end).map(c=>c.text))].join('\n');}
