import {useEffect,useRef,useState} from 'react';
import {useCatalog} from '../context/CatalogContext';
import {ProtectedPlayer,hasProtectedPlayer} from '../player/protectedPlayer';
import {loadProtectionRules,protectionEnabled} from '../player/protectionRules';
import {embedStartUrl} from '../player/embedPresentation';
const servers:Record<string,string>={cinesrc:'https://cinesrc.st/embed',cinezo:'https://player.cinezo.live/embed','vidsrc-mov':'https://vidsrc.mov/embed',vidlink:'https://vidlink.pro','vidsrc-sh':'https://vidsrc.sh/embed'};
export function ProtectedEmbeddedPlayer(){
 const {activePlayback,stopPlayback}=useCatalog();const [busy,setBusy]=useState(false),[error,setError]=useState('');const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;void ProtectedPlayer.close().catch(()=>{});};},[]);
 if(!activePlayback)return null;
 const open=async()=>{if(busy)return;setError('');setBusy(true);try{
  if(!hasProtectedPlayer())throw Error('Rebuild the installed app with the native playback update.');
  const match=/^w32:(movie|tv):(\d+)(?::(\d+):(\d+))?$/.exec(activePlayback.catalogItem.id);if(!match)throw Error('This title does not support protected embedded playback.');
  const variants=(activePlayback.tokenResponse.variants||[]).filter(v=>servers[v.id]);
  const sources=variants.map((v,n)=>({label:`Source ${n+1}`,url:embedStartUrl(`${servers[v.id]}/${match[1]}/${match[2]}${v.id==='cinesrc'?`?autoplay=false&autonext=false${match[1]==='tv'?`&s=${match[3]}&e=${match[4]}`:''}`:match[1]==='tv'?`/${match[3]}/${match[4]}`:''}`,activePlayback.resumeTime||0)}));if(!sources.length)throw Error('No supported player is available.');
  const {rules}=await loadProtectionRules();if(!mounted.current)return;
  await ProtectedPlayer.open({title:activePlayback.catalogItem.seriesTitle||activePlayback.catalogItem.name,sources,selected:Math.max(0,variants.findIndex(v=>v.id===activePlayback.tokenResponse.variantId)),blockedHosts:rules.hosts,protectionEnabled:protectionEnabled()});
  if(mounted.current)stopPlayback();
 }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Player unavailable');}finally{if(mounted.current)setBusy(false);}};
 return <div className="m-player" role="dialog" aria-modal="true" aria-label="Protected video player"><div className="m-player-toolbar"><button onClick={stopPlayback}>Back</button><span>{activePlayback.catalogItem.name}</span></div><div className="m-embed-start"><button className="m-primary" disabled={busy} onClick={open}>{busy?'Opening player…':'Start player'}</button><p>Opens inside MoroShow. Popups and external navigation are blocked.</p>{error&&<p role="alert">{error}</p>}</div></div>;
}

