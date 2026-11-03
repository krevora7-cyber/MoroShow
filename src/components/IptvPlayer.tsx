import {useEffect,useRef,useState} from 'react';
import Hls from 'hls.js';
import {ArrowLeft,Maximize,Volume2,VolumeX} from 'lucide-react';
import {useCatalog} from '../context/CatalogContext';
import {useProfile} from '../context/ProfileContext';
import {resolveMediaUrl} from '../player/netshowApi';
import {enterShortsFullscreen,isIOSDevice} from '../player/shortsPresentation';
import {useDialog} from './useDialog';
export function IptvPlayer(){
 const {activePlayback,stopPlayback,startPlayback,playbackLoading,playbackError}=useCatalog(),{recordHistory,history}=useProfile();
 const video=useRef<HTMLVideoElement>(null),box=useDialog(!!activePlayback,stopPlayback),[error,setError]=useState(''),[volume,setVolume]=useState(1);
 const session=activePlayback,item=session?.catalogItem,token=session?.tokenResponse;
 useEffect(()=>{const v=video.current;if(!v||!item||!token?.streamUrl)return;let hls:Hls|undefined;setError('');const url=resolveMediaUrl(token.streamUrl),resume=session.resumeTime??history.find(h=>h.contentId===item.id&&h.progressPercent<95)?.currentTime??0;let restored=false,lastSave=0;
 const save=()=>{if(Number.isFinite(v.duration)&&v.duration>0)void recordHistory({contentId:item.id,name:item.name,kind:item.kind,category:item.category,posterUrl:item.logoUrl,streamUrl:'',streamType:token.streamType,currentTime:v.currentTime,duration:v.duration});};
 const loaded=()=>{if(!restored&&Number.isFinite(v.duration)){v.currentTime=Math.min(resume,Math.max(0,v.duration-1));restored=true;}void v.play().catch(()=>{});},progress=()=>{if(Date.now()-lastSave>10000){lastSave=Date.now();save();}},fail=()=>setError('This source cannot play on this device. Choose another source.');
 v.addEventListener('loadedmetadata',loaded);v.addEventListener('timeupdate',progress);v.addEventListener('error',fail);v.addEventListener('pause',save);
 if(token.streamType==='hls'&&!v.canPlayType('application/vnd.apple.mpegurl')&&Hls.isSupported()){hls=new Hls({backBufferLength:30});hls.loadSource(url);hls.attachMedia(v);hls.on(Hls.Events.ERROR,(_,d)=>{if(d.fatal)fail();});}else v.src=url;
 return()=>{save();v.removeEventListener('loadedmetadata',loaded);v.removeEventListener('timeupdate',progress);v.removeEventListener('error',fail);v.removeEventListener('pause',save);hls?.destroy();v.pause();v.removeAttribute('src');v.load();};},[item?.id,token?.streamUrl]);
 if(!item||!token)return null;
 const setSound=(n:number)=>{setVolume(n);if(video.current){video.current.volume=n;video.current.muted=!n;}};
 return <div ref={box} className="iptv-vod-player" role="dialog" aria-modal="true" aria-label="Video player"><header><button aria-label="Back" onClick={stopPlayback}><ArrowLeft/></button><strong>{item.name}</strong><button aria-label="Fullscreen" onClick={()=>{if(video.current&&box.current)void enterShortsFullscreen(video.current,box.current,document,isIOSDevice(navigator)).catch(()=>setError('Fullscreen unavailable.'));}}><Maximize/></button></header><div className="iptv-vod-screen"><video ref={video} controls playsInline aria-label={item.name}/><div className="iptv-volume"><button aria-label={volume?'Mute':'Unmute'} onClick={()=>setSound(volume?0:1)}>{volume?<Volume2 size={20}/>:<VolumeX size={20}/>}</button><input aria-label="Volume" type="range" min="0" max="1" step=".05" value={volume} onChange={e=>setSound(Number(e.target.value))}/></div></div><nav aria-label="Playback sources">{token.variants?.map(s=><button aria-pressed={token.variantId===s.id} key={s.id} disabled={playbackLoading} onClick={()=>void startPlayback(item,video.current?.currentTime,s.id)}>{s.label}</button>)}</nav>{(error||playbackError)&&<p role="alert">{error||playbackError}</p>}{playbackLoading&&<p role="status">Connecting…</p>}</div>;
}
