import {useEffect,useRef,useState} from 'react';
import {Play,Volume2,VolumeX} from 'lucide-react';
type Player={playVideo:()=>void;mute:()=>void;unMute:()=>void;setVolume:(volume:number)=>void;destroy:()=>void};
type Api={Player:new(element:HTMLElement,options:Record<string,unknown>)=>Player};
declare global{interface Window{YT?:Api;onYouTubeIframeAPIReady?:()=>void}}
let loading:Promise<Api>|undefined;
export function loadTrailerApi():Promise<Api>{
 if(window.YT?.Player)return Promise.resolve(window.YT);
 if(!loading)loading=new Promise<Api>((resolve,reject)=>{
  const previous=window.onYouTubeIframeAPIReady;
  const timer=window.setTimeout(()=>{loading=undefined;reject(Error('Trailer player unavailable'));},15000);
  window.onYouTubeIframeAPIReady=()=>{previous?.();clearTimeout(timer);window.YT?.Player?resolve(window.YT):reject(Error('Trailer player unavailable'));};
  const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.async=true;script.onerror=()=>{clearTimeout(timer);loading=undefined;script.remove();reject(Error('Trailer player unavailable'));};document.head.appendChild(script);
 });
 return loading;
}
/** One visible hero owns one player. Unmounting destroys it, including audio. */
export function HeroTrailer({id,name}:{id:string;name:string}){
 const host=useRef<HTMLDivElement>(null),player=useRef<Player|null>(null);const [playing,setPlaying]=useState(false),[muted,setMuted]=useState(true),[blocked,setBlocked]=useState(false),[failed,setFailed]=useState(false);
 useEffect(()=>{let cancelled=false;setPlaying(false);setBlocked(false);setFailed(false);setMuted(true);const slot=document.createElement('div');host.current?.appendChild(slot);
  const timer=setTimeout(()=>{if(!cancelled)setBlocked(true);},9000);
  loadTrailerApi().then(api=>{if(cancelled)return;player.current=new api.Player(slot,{host:'https://www.youtube-nocookie.com',videoId:id,playerVars:{autoplay:1,mute:1,controls:0,disablekb:1,playsinline:1,rel:0,origin:location.origin},events:{onReady:(e:{target:Player})=>{if(cancelled)return;e.target.mute();e.target.playVideo();const frame=host.current?.querySelector('iframe');frame?.setAttribute('title',`${name} trailer`);frame?.setAttribute('tabindex','-1');frame?.setAttribute('referrerpolicy','strict-origin-when-cross-origin');},onStateChange:(e:{data:number})=>{if(cancelled)return;setPlaying(e.data===1);if(e.data===1){clearTimeout(timer);setBlocked(false);}if(e.data===0)setBlocked(true);},onAutoplayBlocked:()=>{if(!cancelled)setBlocked(true);},onError:()=>{if(!cancelled){setPlaying(false);setFailed(true);}}}});}).catch(()=>{if(!cancelled)setFailed(true);});
  return()=>{cancelled=true;clearTimeout(timer);player.current?.destroy();player.current=null;slot.remove();};
 },[id,name]);
 return <><div className="m-hero-video" style={{opacity:playing?1:0}} ref={host}/>{!failed&&<button className="m-trailer-control" aria-label={blocked&&!playing?'Play trailer':muted?'Unmute trailer':'Mute trailer'} onClick={()=>{const target=player.current;if(!target)return;if(muted){target.setVolume(100);target.unMute();target.playVideo();setMuted(false);}else{target.mute();setMuted(true);}setBlocked(false);}}>{blocked&&!playing?<><Play size={16} fill="currentColor"/><span>تشغيل الإعلان والصوت</span></>:muted?<><VolumeX size={18}/><span>تشغيل الصوت</span></>:<><Volume2 size={18}/><span>كتم الصوت</span></>}</button>}</>;
}
