import {useEffect,useRef,useState} from 'react';
import {useCatalog} from '../context/CatalogContext';
import {useProfile} from '../context/ProfileContext';
import {ProtectedPlayer,hasProtectedPlayer} from '../player/protectedPlayer';
import {loadProtectionRules,protectionEnabled} from '../player/protectionRules';
import {embedStartUrl,orderEmbedVariants} from '../player/embedPresentation';

export function ProtectedEmbeddedPlayer(){
 const {activePlayback,stopPlayback,startPlayback,playbackError,playbackLoading}=useCatalog();
 const {recordHistory}=useProfile();
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;void ProtectedPlayer.close().catch(()=>{});};},[]);
 if(!activePlayback)return null;
 const open=async()=>{
  if(busy || playbackLoading)return;
  setError('');setBusy(true);
  let listener: {remove():Promise<void>} | undefined;
  try {
   if(!hasProtectedPlayer())throw Error('Rebuild the installed app with the native playback update.');
   const {catalogItem:item,tokenResponse:token,resumeTime}=activePlayback;
   if(!token.embedUrl)throw Error('Player address unavailable.');
   const variants=orderEmbedVariants(token.variants||[],false);
   const selected=variants.findIndex(v=>v.id===token.variantId);
   const session=crypto.randomUUID();
   let position=resumeTime;
   const {rules}=await loadProtectionRules();
   if(!mounted.current)return;
   listener=await ProtectedPlayer.addListener('progress',event=>{
    if(!mounted.current || event.session!==session || !Number.isFinite(event.currentTime) || !Number.isFinite(event.duration) ||
       event.currentTime<=0 || event.currentTime>event.duration || event.duration>86400)return;
    position=event.currentTime;
    void recordHistory({contentId:item.id,name:item.name,kind:item.kind,category:item.category,posterUrl:item.logoUrl,
      variantId:token.variantId,streamType:'hls',currentTime:position,duration:event.duration});
   });
   if(!mounted.current)return;
   const result=await ProtectedPlayer.open({title:item.seriesTitle||item.name,session,
    sources:[{url:embedStartUrl(token.embedUrl,resumeTime),label:'Current source'}],
    choices:variants.map((_,i)=>'Source '+(i+1)),selected,blockedHosts:rules.hosts,protectionEnabled:protectionEnabled()});
   if(!mounted.current)return;
   const next=variants[result.switchTo??-1];
   if(next)await startPlayback(item,position,next.id);
   else stopPlayback();
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Player unavailable');}
  finally{await listener?.remove().catch(()=>{});if(mounted.current)setBusy(false);}
 };
 return <div className="m-player" role="dialog" aria-modal="true" aria-label="Protected video player"><div className="m-player-toolbar"><button onClick={stopPlayback}>Back</button><span>{activePlayback.catalogItem.name}</span></div><div className="m-embed-start"><button className="m-primary" disabled={busy||playbackLoading} onClick={open}>{busy||playbackLoading?'Opening player…':'Start player'}</button><p>Opens inside MoroShow. Popups and external navigation are blocked.</p>{(error||playbackError)&&<p role="alert">{error||playbackError}</p>}</div></div>;
}
