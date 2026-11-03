import {useEffect,useRef,useState} from 'react';
import Hls from 'hls.js';
import {ArrowLeft,RotateCw,Subtitles,ListVideo,ChevronUp,ChevronDown,Play,Pause,Volume2,VolumeX,Maximize,X,Check} from 'lucide-react';
import {useCatalog} from '../context/CatalogContext';
import {useProfile} from '../context/ProfileContext';
import {resolveMediaUrl,apiFetch} from '../player/netshowApi';
import {useDialog} from './useDialog';
import {activeCaptionText,parseCaptionCues,captionAt,type CaptionCue,captionMode,enterShortsFullscreen,isIOSDevice} from '../player/shortsPresentation';
import {matchingSubtitle,readSubtitlePreference,saveSubtitlePreference} from '../player/subtitlePreferences';
import type {CatalogItem} from '../types';
const time=(v:number)=>Number.isFinite(v)?`${Math.floor(v/60)}:${String(Math.floor(v%60)).padStart(2,'0')}`:'0:00';
type Subtitle={url:string;lang:string;label:string};
export function ClipPlayer(){
 const {activePlayback,stopPlayback,startPlayback,playbackLoading,playbackError,rememberSourceItems}=useCatalog();
 const {recordHistory,history,activeProfile}=useProfile();
 const video=useRef<HTMLVideoElement>(null),frame=useRef<HTMLDivElement>(null),bottom=useRef<HTMLDivElement>(null),saved=useRef(0),touch=useRef<{x:number;y:number}|null>(null);
 const [error,setError]=useState(''),[waiting,setWaiting]=useState(true),[captionError,setCaptionError]=useState(''),[drawer,setDrawer]=useState<'episodes'|'subtitles'|null>(null),[episodes,setEpisodes]=useState<CatalogItem[]>([]),[episodeError,setEpisodeError]=useState(''),[paused,setPaused]=useState(true),[muted,setMuted]=useState(false),[position,setPosition]=useState(0),[duration,setDuration]=useState(0);
 const [caption,setCaption]=useState(''),[nativeFullscreen,setNativeFullscreen]=useState(false),[fullscreenError,setFullscreenError]=useState('');
 const [subtitleTracks,setSubtitleTracks]=useState<Subtitle[]>([]),[selectedLanguage,setSelectedLanguage]=useState('off'),[discovering,setDiscovering]=useState(false),[discoveryAttempt,setDiscoveryAttempt]=useState(0),[discoveryComplete,setDiscoveryComplete]=useState(false);
 const captionCues=useRef<CaptionCue[]>([]);
 const discoveredFor=useRef(''),preference=useRef(readSubtitlePreference(activeProfile?.id));
 const session=activePlayback,item=session?.catalogItem,url=session?.tokenResponse.streamUrl,seriesId=item?.id.replace(/:\d+$/,'');
 const dialog=useDialog(!!session,()=>drawer?setDrawer(null):stopPlayback());
 const index=episodes.findIndex(e=>e.id===item?.id),previous=index>0?episodes[index-1]:undefined,next=index>=0?episodes[index+1]:undefined;
 const nearEnd=duration>0&&duration-position<=30;
 useEffect(()=>{if(!nearEnd||waiting||playbackLoading||!next?.id.startsWith('drama:')||!activeProfile||(navigator as any).connection?.saveData)return;const abort=new AbortController();void apiFetch('/api/shorts/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profileId:activeProfile.id,contentId:next.id}),signal:abort.signal}).catch(()=>{});return()=>abort.abort();},[next?.id,nearEnd,activeProfile?.id,playbackLoading,waiting]);
 const select=(episode:CatalogItem|undefined)=>{if(!episode||playbackLoading)return;setDrawer(null);void startPlayback(episode,undefined,'shorts');};
 const chooseSubtitle=(lang:string)=>{preference.current=lang;saveSubtitlePreference(activeProfile?.id,lang);setSelectedLanguage(lang);setCaption('');setCaptionError('');setDrawer(null);};
 useEffect(()=>{if(!seriesId||!activeProfile)return;const a=new AbortController();setEpisodes([]);setEpisodeError('');apiFetch(`/api/series/${encodeURIComponent(seriesId)}/episodes?profileId=${activeProfile.id}`,{signal:a.signal}).then(r=>r.json()).then(d=>{if(a.signal.aborted)return;if(!d.success)throw new Error('Episodes unavailable');setEpisodes(d.episodes||[]);rememberSourceItems(d.episodes||[]);}).catch(()=>{if(!a.signal.aborted)setEpisodeError('Could not load the episode list. Reopen this series to try again.');});return()=>a.abort();},[seriesId,activeProfile?.id]);
 useEffect(()=>{
  const tracks=session?.tokenResponse.subtitles||[];setSubtitleTracks(tracks);setSelectedLanguage(matchingSubtitle(preference.current,tracks));
  discoveredFor.current='';setDiscoveryComplete(false);setCaptionError('');setCaption('');setFullscreenError('');setDrawer(null);setPosition(0);setDuration(0);setWaiting(true);setError('');
 },[url,item?.id,session?.tokenResponse.token]);
 useEffect(()=>{
  const needsPreference=preference.current!=='off'&&matchingSubtitle(preference.current,session?.tokenResponse.subtitles||[])==='off';
  if((drawer!=='subtitles'&&!needsPreference)||!url||!item||discoveredFor.current===item.id)return;
  const a=new AbortController();setDiscovering(true);setCaptionError('');
  apiFetch(`/api/shorts/subtitles?profileId=${activeProfile?.id}&contentId=${encodeURIComponent(item.id)}`,{signal:a.signal}).then(r=>r.json()).then(d=>{
   if(a.signal.aborted)return;if(!d.success)throw new Error('Could not check additional subtitles.');
   setDiscoveryComplete(d.complete!==false);if(d.complete!==false)discoveredFor.current=item.id;else setCaptionError('Some subtitle languages could not be checked. You can try again.');const tracks=[...new Map([...(session?.tokenResponse.subtitles||[]),...(d.subtitles||[])].map((s:Subtitle)=>[s.lang.toLowerCase(),s])).values()] as Subtitle[];
   setSubtitleTracks(tracks);setSelectedLanguage(matchingSubtitle(preference.current,tracks));
  }).catch(()=>{if(!a.signal.aborted)setCaptionError('Could not check additional subtitles. Your existing tracks are still available.');}).finally(()=>{if(!a.signal.aborted)setDiscovering(false);});
  return()=>{a.abort();setDiscovering(false);};
 },[drawer,item?.id,url,discoveryAttempt]);
 useEffect(()=>{
  captionCues.current=[];setCaption('');if(selectedLanguage==='off')return;
  const track=subtitleTracks.find(s=>s.lang===selectedLanguage);if(!track)return;const a=new AbortController();
  // Own cue timing avoids Safari's automatic native renderer in inline mode.
  fetch(resolveMediaUrl(track.url),{signal:a.signal}).then(r=>{if(!r.ok)throw new Error('Subtitle unavailable');return r.text();}).then(text=>{
   if(a.signal.aborted)return;captionCues.current=parseCaptionCues(text);if(!nativeFullscreen)setCaption(captionAt(captionCues.current,video.current?.currentTime||0));
  }).catch(()=>{if(!a.signal.aborted)setCaptionError('This subtitle file could not load. Try another language.');});
  return()=>a.abort();
 },[selectedLanguage,subtitleTracks]);
 useEffect(()=>{
  const v=video.current;if(!v)return;setCaption('');const bound=new Set<TextTrack>();
  const update=()=>setCaption(selectedLanguage!=='off'&&!nativeFullscreen?captionCues.current.length?captionAt(captionCues.current,v.currentTime):activeCaptionText(Array.from(v.textTracks),selectedLanguage):'');
  const apply=()=>{let chosen=false;for(const t of Array.from(v.textTracks)){
   // One renderer and one selected track, including any in-band HLS tracks.
   const selected=!chosen&&t.language.toLowerCase()===selectedLanguage.toLowerCase();if(selected)chosen=true;
   t.mode=selected?captionMode(true,t.language,nativeFullscreen,selectedLanguage):'disabled';
   if(!bound.has(t)){t.addEventListener('cuechange',update);bound.add(t);}
  }update();};
  const begin=()=>{v.classList.add('ms-native-captions');setNativeFullscreen(true);},end=()=>{v.classList.remove('ms-native-captions');setNativeFullscreen(false);};
  v.addEventListener('webkitbeginfullscreen',begin);v.addEventListener('webkitendfullscreen',end);
  v.addEventListener('loadedmetadata',apply);v.addEventListener('timeupdate',update);v.addEventListener('seeked',update);v.textTracks.addEventListener('addtrack',apply);v.textTracks.addEventListener('change',update);apply();
  return()=>{for(const t of bound)t.removeEventListener('cuechange',update);v.removeEventListener('webkitbeginfullscreen',begin);v.removeEventListener('webkitendfullscreen',end);v.removeEventListener('loadedmetadata',apply);v.removeEventListener('timeupdate',update);v.removeEventListener('seeked',update);v.textTracks.removeEventListener('addtrack',apply);v.textTracks.removeEventListener('change',update);};
 },[selectedLanguage,nativeFullscreen,subtitleTracks,url,item?.id,session?.tokenResponse.token]);
 useEffect(()=>{const b=bottom.current,f=frame.current;if(!b||!f)return;const measure=()=>f.style.setProperty('--shorts-bottom-height',`${b.getBoundingClientRect().height}px`);measure();const observer=new ResizeObserver(measure);observer.observe(b);return()=>observer.disconnect();},[item?.id]);
 useEffect(()=>{
  const v=video.current;if(!v||!url||!item)return;setError('');setWaiting(true);setPaused(true);saved.current=0;let hls:Hls|undefined;
  const resume=session?.resumeTime??history.find(h=>h.contentId===item.id&&h.progressPercent<95)?.currentTime??0;
  let resumeApplied=resume<=0;const resumeReady=()=>{if(resumeApplied)return true;if(!Number.isFinite(v.duration)||v.duration<=0)return false;if(url.includes('/compatible/')&&v.duration<resume+0.1){v.pause();setWaiting(true);return false;}v.currentTime=Math.min(resume,v.duration);resumeApplied=true;return true;};
  const playWhenReady=()=>{if(resumeReady())void v.play().catch(()=>{setWaiting(false);setPaused(true);});};
  const loaded=()=>{setDuration(Number.isFinite(v.duration)?v.duration:0);playWhenReady();};
  const failed=()=>{clearTimeout(timer);setWaiting(false);setError('This episode could not play. Retry to request a fresh source.');};
  const save=()=>{if(!resumeApplied||!Number.isFinite(v.duration)||v.duration<=0)return;void recordHistory({contentId:item.id,name:item.name,kind:item.kind,category:item.category,posterUrl:item.logoUrl,streamUrl:'',streamType:session?.tokenResponse.streamType||'hls',currentTime:v.currentTime,duration:v.duration});};
  const progress=()=>{setPosition(v.currentTime);if(v.currentTime>4&&v.videoWidth===0){setWaiting(false);setError('Audio is playing without a picture. Try compatible video.');}if(Date.now()-saved.current>10000){saved.current=Date.now();save();}};
  const durationChanged=()=>{if(Number.isFinite(v.duration))setDuration(v.duration);if(!resumeApplied)playWhenReady();};
  const onPause=()=>{setPaused(true);save();},onPlay=()=>setPaused(false),playing=()=>{clearTimeout(timer);setError('');setWaiting(false);setPaused(false);};
  v.addEventListener('durationchange',durationChanged);v.addEventListener('loadedmetadata',loaded);v.addEventListener('playing',playing);v.addEventListener('play',onPlay);v.addEventListener('error',failed);v.addEventListener('timeupdate',progress);v.addEventListener('pause',onPause);v.addEventListener('ended',save);
  const timer=window.setTimeout(()=>{setWaiting(false);setError('The source is taking too long. Please retry.');},30000);
  const source=resolveMediaUrl(url);if(session?.tokenResponse.streamType==='mp4'||v.canPlayType('application/vnd.apple.mpegurl'))v.src=source;else if(Hls.isSupported()){
   hls=new Hls({maxBufferLength:20,backBufferLength:30,renderTextTracksNatively:false});hls.loadSource(source);hls.attachMedia(v);hls.on(Hls.Events.ERROR,(_,d)=>{if(d.fatal)failed();});
  }else failed();
  return()=>{clearTimeout(timer);save();v.removeEventListener('durationchange',durationChanged);v.removeEventListener('loadedmetadata',loaded);v.removeEventListener('playing',playing);v.removeEventListener('play',onPlay);v.removeEventListener('error',failed);v.removeEventListener('timeupdate',progress);v.removeEventListener('pause',onPause);v.removeEventListener('ended',save);hls?.destroy();v.pause();v.removeAttribute('src');v.load();const compatible=/^(\/api\/shorts\/compatible\/[a-f0-9]{48})\/index\.m3u8$/.exec(url);if(compatible)void apiFetch(compatible[1],{method:'DELETE',keepalive:true}).catch(()=>{});};
 },[url,item?.id,session?.tokenResponse.token]);
 if(!session||!item)return null;
 const retry=()=>void startPlayback(item,video.current?.currentTime,'shorts');
 const compatible=()=>void startPlayback(item,video.current?.currentTime,'shorts-compatible');
 const togglePlay=()=>{const v=video.current;if(!v||!url||playbackLoading)return;if(v.paused)void v.play().catch(()=>setError('Tap play to try again.'));else v.pause();};
 const fullscreen=()=>{const v=video.current,f=frame.current;if(!v||!f)return;setFullscreenError('');if(v.readyState<1){setFullscreenError('Wait for the video to load, then try fullscreen.');return;}
  // Prepare native captions in the same gesture, before Safari opens its native view.
  if(isIOSDevice(navigator)){for(const element of Array.from(v.querySelectorAll('track')))element.default=element.srclang===selectedLanguage;let chosen=false;for(const t of Array.from(v.textTracks)){const yes=!chosen&&t.language===selectedLanguage;if(yes)chosen=true;t.mode=yes?'showing':'disabled';}v.classList.add('ms-native-captions');}
  void enterShortsFullscreen(v,f,document,isIOSDevice(navigator)).catch(()=>{v.classList.remove('ms-native-captions');setNativeFullscreen(false);setFullscreenError('Fullscreen is unavailable in this browser. Try Safari or Chrome.');});
 };
 return <div ref={dialog} className="ms-player" role="dialog" aria-modal="true" aria-label="Shorts player"><div className="ms-player-ambient" style={{backgroundImage:`url("${item.logoUrl||''}")`}}/><div className="ms-player-frame" ref={frame} onTouchStart={e=>{const t=e.touches[0],target=e.target as HTMLElement;if(drawer||target.closest('button,input')||t.clientY>window.innerHeight-95)return;touch.current={x:t.clientX,y:t.clientY};}} onTouchEnd={e=>{const start=touch.current;touch.current=null;if(!start||drawer)return;const t=e.changedTouches[0],dy=t.clientY-start.y,dx=t.clientX-start.x;if(Math.abs(dy)>85&&Math.abs(dy)>Math.abs(dx)*1.5)select(dy<0?next:previous);}}>
 <video key={item.id} ref={video} className={'ms-short-video'+(nativeFullscreen?' ms-native-captions':'')} playsInline autoPlay poster={item.logoUrl} onClick={togglePlay} onEnded={()=>select(next)} aria-label={`${item.seriesTitle||item.name} — Episode ${item.episode}`}>
 {subtitleTracks.map(sub=><track key={sub.url} kind="subtitles" src={resolveMediaUrl(sub.url)} srcLang={sub.lang} label={sub.label} default={nativeFullscreen&&selectedLanguage===sub.lang} onLoad={e=>{const t=e.currentTarget.track;t.mode=captionMode(selectedLanguage===sub.lang,sub.lang,nativeFullscreen,selectedLanguage);setCaption(selectedLanguage!=='off'&&!nativeFullscreen?activeCaptionText(Array.from(video.current?.textTracks||[]),selectedLanguage):'');}} onError={()=>setCaptionError('This subtitle file could not load. Try another language or reopen the episode.')}/>)}</video>
 {caption&&!drawer&&!nativeFullscreen&&<div className="ms-captions" dir="auto"><span>{caption}</span></div>}
 <div className="ms-top"><button className="ms-glass-icon" aria-label="Back to Shorts" onClick={stopPlayback}><ArrowLeft size={23}/></button><span className="ms-watch-label">SHORTS</span><button className="ms-glass-icon" aria-label="Fullscreen" onClick={fullscreen}><Maximize size={20}/></button></div>
 {paused&&!waiting&&!error&&!playbackError&&!playbackLoading&&<button className="ms-center-play" aria-label="Play" onClick={togglePlay}><Play size={38} fill="currentColor"/></button>}
 <div className="ms-action-rail"><button className={selectedLanguage!=='off'?'is-on':''} aria-label="Subtitles" onClick={()=>setDrawer('subtitles')}><span><Subtitles size={27}/></span><small>Subtitles</small></button><button aria-label="Episode list" onClick={()=>setDrawer('episodes')}><span><ListVideo size={26}/></span><small>Episodes</small></button><button aria-label="Previous episode" disabled={!previous||playbackLoading} onClick={()=>select(previous)}><span><ChevronUp size={27}/></span><small>Previous</small></button><button aria-label="Next episode" disabled={!next||playbackLoading} onClick={()=>select(next)}><span><ChevronDown size={27}/></span><small>Next</small></button><button aria-label={muted?'Unmute':'Mute'} onClick={()=>{if(video.current){video.current.muted=!muted;setMuted(!muted);}}}><span>{muted?<VolumeX size={24}/>:<Volume2 size={24}/>}</span><small>{muted?'Unmute':'Mute'}</small></button></div>
 <div className="ms-bottom" ref={bottom}><div className="ms-series-copy" dir="auto"><span className="ms-episode-tag">Episode {item.episode}{episodes.length?` / ${episodes.length}`:''}</span><h1>{item.seriesTitle||item.name}</h1><button onClick={()=>setDrawer('episodes')}>All episodes <ChevronUp size={14}/></button></div><div className="ms-transport"><button aria-label={paused?'Play':'Pause'} disabled={playbackLoading} onClick={togglePlay}>{paused?<Play size={18} fill="currentColor"/>:<Pause size={18} fill="currentColor"/>}</button><span>{time(position)}</span><input type="range" aria-label="Seek" min="0" max={duration||1} step="0.1" disabled={!duration||playbackLoading} value={Math.min(position,duration||1)} onChange={e=>{if(video.current){video.current.currentTime=Number(e.target.value);setPosition(Number(e.target.value));}}}/><span>{time(duration)}</span></div></div>
 {((waiting&&!error&&!playbackError)||playbackLoading)&&<div className="ms-loading" role="status"><i/>Loading episode…</div>}{(error||playbackError)&&<div role="alert" className="ms-source-error"><p>{playbackError||error}</p><button onClick={retry} disabled={playbackLoading}><RotateCw size={16}/>Retry episode</button>{url&&<button onClick={compatible} disabled={playbackLoading}>Try compatible video</button>}</div>}{(captionError||fullscreenError)&&<p className="ms-caption-error" role="status">{captionError||fullscreenError}</p>}
 {drawer&&<div className="ms-sheet-shade" onClick={()=>setDrawer(null)}><section className="ms-sheet" role="dialog" aria-label={drawer==='episodes'?'Choose episode':'Subtitle settings'} onClick={e=>e.stopPropagation()}><div className="ms-sheet-handle"/><header><div><small dir="auto">{item.seriesTitle||item.name}</small><h2>{drawer==='episodes'?'Episodes':'Subtitles'}</h2></div><button autoFocus aria-label="Close menu" onClick={()=>setDrawer(null)}><X size={22}/></button></header>{drawer==='episodes'?<>{episodeError&&<p role="alert">{episodeError}</p>}{!episodes.length&&!episodeError&&<p role="status">Loading episodes…</p>}<div className="ms-episode-grid">{episodes.map(e=><button key={e.id} className={e.id===item.id?'current':''} aria-current={e.id===item.id?'true':undefined} aria-label={`Play episode ${e.episode}`} disabled={playbackLoading} onClick={()=>select(e)}>{e.episode}</button>)}</div></>:<div className="ms-subtitle-options"><button onClick={()=>chooseSubtitle('off')}><span>Off</span>{selectedLanguage==='off'&&<Check size={20}/>}</button>{subtitleTracks.map(sub=><button key={sub.lang} onClick={()=>chooseSubtitle(sub.lang)}><span>{sub.label}<small>{sub.lang}</small></span>{selectedLanguage===sub.lang&&<Check size={20}/>}</button>)}{discovering&&<p role="status">Checking available languages…</p>}{!discovering&&!subtitleTracks.length&&discoveryComplete&&<p>The source did not provide a subtitle file for this episode.</p>}{captionError&&!discovering&&<button onClick={()=>setDiscoveryAttempt(v=>v+1)}>Check again</button>}<p className="m-help">Only subtitle files supplied for this episode are listed. Subtitles already printed into the video cannot be turned off.</p></div>}</section></div>}
 </div></div>;
}
