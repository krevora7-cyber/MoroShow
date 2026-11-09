import {useEffect,useRef,useState} from 'react';
import {useCatalog} from '../context/CatalogContext';
import {useProfile} from '../context/ProfileContext';
import {ProtectedPlayer,hasProtectedPlayer} from '../player/protectedPlayer';
import {loadProtectionRules,protectionEnabled} from '../player/protectionRules';
import {embedStartUrl} from '../player/embedPresentation';
export function ProtectedEmbeddedPlayer(){
 const {activePlayback,stopPlayback}=useCatalog();const {recordHistory}=useProfile();const [busy,setBusy]=useState(false),[error,setError]=useState('');const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;void ProtectedPlayer.close().catch(()=>{});};},[]);
 if(!activePlayback)return null;
 const open=async()=>{if(busy)return;setError('');setBusy(true);try{
  if(!hasProtectedPlayer())throw Error('Rebuild the installed app with the native playback update.');
  const item=activePlayback.catalogItem;const match=/^w32:(movie|tv):(\d+)(?::(\d+):(\d+))?$/.exec(item.id);if(!match)throw Error('This title does not support embedded playback.');
  const [,kind,id,season,episode]=match; if(kind==='tv'&&(!season||!episode))throw Error('Choose an episode first.');
  const suffix=kind==='tv'?`/${season}/${episode}`:'';
  const sources=[{label:'Source 1',url:embedStartUrl(`https://cinesrc.st/embed/${kind}/${id}?autoplay=false&autonext=false${kind==='tv'?`&s=${season}&e=${episode}`:''}`,activePlayback.resumeTime||0)},
    {label:'Source 2 (test)',url:embedStartUrl(`https://mapple.fun/watch/${kind}/${id}${kind==='tv'?`-${season}-${episode}`:''}`,activePlayback.resumeTime||0)},
    {label:'Source 3 (test)',url:`https://vidup.to/${kind}/${id}${suffix}?autoPlay=false&theme=FF0000`}];
  const {rules}=await loadProtectionRules();if(!mounted.current)return;
  const result=await ProtectedPlayer.open({title:item.seriesTitle||item.name,sources,selected:0,blockedHosts:rules.hosts,protectionEnabled:protectionEnabled()});
  const time=result.currentTime,duration=result.duration;
  if(typeof time==='number'&&typeof duration==='number'&&Number.isFinite(time)&&Number.isFinite(duration)&&time>1&&duration>0&&duration<=86400&&time<=duration+5){await recordHistory({contentId:item.id,name:item.name,kind:item.kind,category:item.category,posterUrl:item.logoUrl,streamUrl:'',streamType:'hls',currentTime:Math.min(time,duration),duration});}
  if(mounted.current)stopPlayback();
 }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Player unavailable');}finally{if(mounted.current)setBusy(false);}};
 return <div className="m-player" role="dialog" aria-modal="true" aria-label="Video player"><div className="m-player-toolbar"><button onClick={stopPlayback}>Back</button><span>{activePlayback.catalogItem.name}</span></div><div className="m-embed-start"><button className="m-primary" disabled={busy} onClick={open}>{busy?'Opening player…':'Start player'}</button><p>Sources 2 and 3 are experimental. Availability and ads depend on the provider.</p>{error&&<p role="alert">{error}</p>}</div></div>;
}
