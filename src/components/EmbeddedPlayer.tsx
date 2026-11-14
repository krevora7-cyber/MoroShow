import './WebPlayback.css';
import {createPortal} from 'react-dom';
import {browserPlayback,type BrowserPlaybackMode} from '../player/browserPlayback';
import {Capacitor} from '@capacitor/core';
import {ProtectedEmbeddedPlayer} from './ProtectedEmbeddedPlayer';
import {readEmbedProgress} from '../player/embedEvents';
import {readVidstuckProgress} from '../player/vidstuckProgress';
import {useProfile} from '../context/ProfileContext';
import {useEffect,useState,useRef,useMemo} from 'react';
import {ArrowLeft,RotateCw,Play,Maximize,Minimize} from 'lucide-react';
import {useCatalog} from '../context/CatalogContext';
import {useDialog} from './useDialog';
import {isIOSDevice} from '../player/shortsPresentation';
import {embedStartUrl,orderEmbedVariants} from '../player/embedPresentation';
export function EmbeddedPlayer(){const {activePlayback,stopPlayback,startPlayback,playbackLoading,playbackError}=useCatalog();const [retry,setRetry]=useState(0),[fullscreen,setFullscreen]=useState(false),[fullscreenError,setFullscreenError]=useState('');const {recordHistory,history}=useProfile();const frame=useRef<HTMLIFrameElement>(null);const lastSaved=useRef(0);const ref=useDialog(!!activePlayback,stopPlayback);const url=activePlayback?.tokenResponse.embedUrl;
 const mode:BrowserPlaybackMode='protected';
 const ios=isIOSDevice(navigator);const [started,setStarted]=useState(!ios);const sessionKey=activePlayback?`${activePlayback.catalogItem.id}:${activePlayback.tokenResponse.variantId}:${retry}:${mode}`:null;useEffect(()=>setStarted(!ios),[sessionKey,ios]);
 // Capture resume only on a new session or explicit retry. History saves must never navigate the iframe.
 const playerUrl=useMemo(()=>{if(!url||!activePlayback)return '';const h=history.find(h=>h.contentId===activePlayback.catalogItem.id);try{return embedStartUrl(url,activePlayback.resumeTime??(h&&h.progressPercent<95?h.currentTime:0));}catch{return '';}},[url,activePlayback?.catalogItem.id,activePlayback?.resumeTime,activePlayback?.tokenResponse.variantId,retry]);
 useEffect(()=>{
  const sync=()=>setFullscreen(document.fullscreenElement===ref.current);
  document.addEventListener('fullscreenchange',sync);
  return()=>document.removeEventListener('fullscreenchange',sync);
 },[ref]);
 useEffect(()=>{lastSaved.current=0;const listener=(e:MessageEvent)=>{
 if(!activePlayback||!url||e.source!==frame.current?.contentWindow)return;
 const expectedOrigin=new URL(url).origin;const progress=expectedOrigin==='https://vidstuck.cc'?readVidstuckProgress(e.origin,e.data,activePlayback.catalogItem.id):(mode!=='protected'?readEmbedProgress(e.origin,e.data,expectedOrigin,activePlayback.catalogItem.id):null);if(!progress)return;
 const i=activePlayback.catalogItem,{time,duration,event}=progress;
 if(Date.now()-lastSaved.current<5000&&!['pause','ended','seeked'].includes(event))return;lastSaved.current=Date.now();
 void recordHistory({contentId:i.id,name:i.name,kind:i.kind,category:i.category,posterUrl:i.logoUrl,streamUrl:'',streamType:'hls',currentTime:Math.min(time,duration),duration});
 };window.addEventListener('message',listener);return()=>window.removeEventListener('message',listener);},[activePlayback,mode]);
 if (!activePlayback || !url) return null;
 if (Capacitor.isNativePlatform()) return <ProtectedEmbeddedPlayer key={activePlayback.catalogItem.id}/>;

 const { catalogItem, tokenResponse } = activePlayback;
 const title = catalogItem.seriesTitle || catalogItem.name;
 const episode = catalogItem.season && catalogItem.episode ? `S${catalogItem.season} · E${catalogItem.episode}` : '';
 const detail = [episode, episode && catalogItem.name !== title ? catalogItem.name : ''].filter(Boolean).join(' · ');
 const variants = orderEmbedVariants(tokenResponse.variants || [], ios);
 let config: ReturnType<typeof browserPlayback> | undefined;
 try { config = browserPlayback(playerUrl, mode); } catch {}

 async function toggleFullscreen() {
  setFullscreenError('');
  try {
   if (document.fullscreenElement === ref.current) await document.exitFullscreen();
   else await ref.current?.requestFullscreen();
  } catch { setFullscreenError('Fullscreen is unavailable.'); }
 }

 return createPortal(
  <div ref={ref} className="moro-web-player" role="dialog" aria-modal="true" aria-label="Video player">
   <header className="moro-web-bar">
    <button type="button" className="moro-web-button" onClick={stopPlayback} aria-label="Back to browsing" title="Back to browsing">
     <ArrowLeft size={24}/>
    </button>
    <div className="moro-web-heading">
     <h2>{title}</h2>
     {detail && <p>{detail}</p>}
    </div>
    <div className="moro-web-actions">
     {variants.length > 1 && <select
      className="moro-web-source"
      aria-label="Playback source"
      disabled={playbackLoading}
      value={tokenResponse.variantId || ''}
      onChange={event => void startPlayback(catalogItem, history.find(h => h.contentId === catalogItem.id)?.currentTime, event.target.value)}
     >
      {variants.map((variant, index) => <option key={variant.id} value={variant.id}>Source {index + 1}</option>)}
     </select>}
     <button type="button" className="moro-web-button" aria-label="Reload player" title="Reload player" onClick={()=>setRetry(n=>n+1)}>
      <RotateCw size={20}/>
     </button>
     {document.fullscreenEnabled && <button
      type="button" className="moro-web-button"
      aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      onClick={() => void toggleFullscreen()}
     >
      {fullscreen ? <Minimize size={22}/> : <Maximize size={22}/>}
     </button>}
    </div>
   </header>
   <div className="moro-web-stage">
    {(playbackError || fullscreenError || playbackLoading) && <p className="moro-web-status" role={playbackError || fullscreenError ? 'alert' : 'status'}>
     {playbackError || fullscreenError || 'Switching source…'}
    </p>}
    {config && started ? <iframe
     ref={frame} key={sessionKey} src={config.url} title={catalogItem.name}
     allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen
     sandbox={config.sandbox} referrerPolicy={config.referrerPolicy}
    /> : <div className="moro-web-start">
     {config ? <>
      <button type="button" className="moro-web-button" onClick={() => setStarted(true)}><Play size={20} fill="currentColor"/> Start player</button>
      <p>Tap Play inside the player to start the video.</p>
     </> : <p>Player address is not supported.</p>}
    </div>}
   </div>
  </div>,
  document.body,
 );
}
