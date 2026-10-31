import {readEmbedProgress} from '../player/embedEvents';
import {useProfile} from '../context/ProfileContext';
import {useEffect,useState,useRef,useMemo} from 'react';
import {ArrowLeft,RotateCw} from 'lucide-react';
import {useCatalog} from '../context/CatalogContext';
import {useDialog} from './useDialog';
import {isIOSDevice} from '../player/shortsPresentation';
import {embedStartUrl,orderEmbedVariants} from '../player/embedPresentation';
const origins=new Set(['https://player.cinezo.live','https://vidsrc.mov','https://vidlink.pro','https://vidsrc.sh','https://dramatip.net']);
export function EmbeddedPlayer(){const {activePlayback,stopPlayback,startPlayback,playbackLoading,playbackError}=useCatalog();const [retry,setRetry]=useState(0),[help,setHelp]=useState(false);const {recordHistory,history}=useProfile();const frame=useRef<HTMLIFrameElement>(null);const lastSaved=useRef(0);const ref=useDialog(!!activePlayback,stopPlayback);const url=activePlayback?.tokenResponse.embedUrl;
 const ios=isIOSDevice(navigator);
 // Capture resume only on a new session or explicit retry. History saves must never navigate the iframe.
 const playerUrl=useMemo(()=>{if(!url||!activePlayback)return '';const h=history.find(h=>h.contentId===activePlayback.catalogItem.id);try{return embedStartUrl(url,activePlayback.resumeTime??(h&&h.progressPercent<95?h.currentTime:0));}catch{return '';}},[activePlayback,retry]);
 useEffect(()=>{setHelp(false);const t=setTimeout(()=>setHelp(true),18000);return()=>clearTimeout(t);},[url,retry]);
 useEffect(()=>{lastSaved.current=0;const listener=(e:MessageEvent)=>{
 if(!activePlayback||!url||e.source!==frame.current?.contentWindow)return;
 const progress=readEmbedProgress(e.origin,e.data,new URL(url).origin,activePlayback.catalogItem.id);if(!progress)return;
 const i=activePlayback.catalogItem,{time,duration,event}=progress;
 if(Date.now()-lastSaved.current<5000&&!['pause','ended','seeked'].includes(event))return;lastSaved.current=Date.now();
 void recordHistory({contentId:i.id,name:i.name,kind:i.kind,category:i.category,posterUrl:i.logoUrl,streamUrl:'',streamType:'hls',currentTime:Math.min(time,duration),duration});
 };window.addEventListener('message',listener);return()=>window.removeEventListener('message',listener);},[activePlayback]);
 if(!activePlayback||!url)return null;let valid=false;try{valid=origins.has(new URL(url).origin);}catch{}return <div ref={ref} className="m-player" role="dialog" aria-modal="true" aria-label="Video player"><div className="m-player-toolbar"><button onClick={stopPlayback} aria-label="Back to browsing"><ArrowLeft size={22}/></button><span>{activePlayback.catalogItem.seriesTitle||activePlayback.catalogItem.name}</span><button aria-label="Reload player" onClick={()=>setRetry(v=>v+1)}><RotateCw size={20}/></button></div><div className="m-player-servers">{orderEmbedVariants(activePlayback.tokenResponse.variants||[],ios).map(v=><button className={activePlayback.tokenResponse.variantId===v.id?'selected':''} key={v.id} disabled={playbackLoading} onClick={()=>startPlayback(activePlayback.catalogItem,undefined,v.id)}>{v.label}</button>)}</div>{playbackLoading&&<p role="status" className="m-player-help">Switching server…</p>}{playbackError&&<p role="alert" className="m-player-help">{playbackError}</p>}{help&&valid&&<div className="m-player-help"><span>{'If playback stays black, try another server. Audio and subtitles are controlled by the original player.'}</span><button aria-label="Dismiss help" onClick={()=>setHelp(false)}>✕</button></div>}{valid?<iframe ref={frame} key={`${activePlayback.catalogItem.id}:${activePlayback.tokenResponse.variantId}:${retry}`} src={playerUrl} title={activePlayback.catalogItem.name} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen sandbox="allow-scripts allow-same-origin allow-forms allow-presentation" referrerPolicy="strict-origin-when-cross-origin"/>:<p>Player address is not supported.</p>}</div>}
