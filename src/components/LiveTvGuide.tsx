import {Capacitor} from '@capacitor/core';
import {catalogJson} from '../player/catalogCache';
import {useEffect,useRef,useState} from 'react';
import Hls from 'hls.js';
import {Search,Heart,Play,Pause,Volume2,VolumeX,Maximize,Minimize,RotateCw,Radio,ChevronDown,ChevronUp,List,X,LoaderCircle,Settings} from 'lucide-react';
import {useProfile} from '../context/ProfileContext';
import {isIOSDevice} from '../player/shortsPresentation';
import {apiFetch,resolveMediaUrl} from '../player/netshowApi';
import './LiveTvGuide.css';
import './WebPlayback.css';
type Channel={sources?:{id:string;label:string}[];id:string;name:string;category:string;logoUrl?:string;epg?:{title:string;start:string;end:string}[]};
type Group={id:string;name:string;badge?:string;count?:number};
const LAST_CHANNEL_KEY = 'moroshow-live:last-channel-v2';
const PUBLIC_START_CHANNELS = ['Al Jazeera English', 'France 24 English', 'NASA TV'];
const IPTV_START_CHANNELS = ['al aoula', '2m', 'france 24'];
const DEFAULT_GROUPS:Group[]=[{id:'all',name:'All channels'}];
export function LiveTvGuide(){
 const {activeProfile,favorites,toggleFavorite}=useProfile();
 const catalogType=Capacitor.isNativePlatform()?'public':'xtream';
 const [groups,setGroups]=useState(DEFAULT_GROUPS),[category,setCategory]=useState('all'),[search,setSearch]=useState(''),[query,setQuery]=useState(''),[channels,setChannels]=useState<Channel[]>([]),[cursor,setCursor]=useState<string|null>(null),[page,setPage]=useState(''),[loading,setLoading]=useState(true),[listError,setListError]=useState(''),[listRetry,setListRetry]=useState(0);
 const [sourceId,setSourceId]=useState(''),[activeSource,setActiveSource]=useState(''),[settingsOpen,setSettingsOpen]=useState(false);
 const [categorySearch,setCategorySearch]=useState('');
 const [fullscreen,setFullscreen]=useState(false),[fullscreenError,setFullscreenError]=useState('');
 const automatic=useRef<Channel[]>([]),manualChoice=useRef(false);
 const [drawer,setDrawer]=useState(true);const [sort,setSort]=useState('az');
 const [selected,setSelected]=useState<Channel|null>(null),[retry,setRetry]=useState(0),[connecting,setConnecting]=useState(false),[error,setError]=useState(''),[paused,setPaused]=useState(true),[muted,setMuted]=useState(false),[quality,setQuality]=useState(-1),[levels,setLevels]=useState<{height:number;index:number}[]>([]),[controls,setControls]=useState(true);
 const videoRef=useRef<HTMLVideoElement>(null),frameRef=useRef<HTMLDivElement>(null),roomRef=useRef<HTMLElement>(null),hlsRef=useRef<Hls|null>(null),playAttempt=useRef(0),autoRetries=useRef(0),failedSources=useRef<string[]>([]),hideTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 useEffect(()=>{const t=setTimeout(()=>{setQuery(search.trim());setPage('');},350);return()=>clearTimeout(t);},[search]);
 useEffect(()=>{setSelected(null);automatic.current=[];manualChoice.current=false;failedSources.current=[];autoRetries.current=0;setChannels([]);setCategory('all');setPage('');},[activeProfile?.id]);
 useEffect(()=>{
 if(!activeProfile||activeProfile.isKid){setLoading(false);return;}const ac=new AbortController();let refreshTimer:ReturnType<typeof setTimeout>|undefined;setLoading(true);setListError('');
 if(!page)setChannels([]);
 const url='/api/live/channels?'+new URLSearchParams({profileId:activeProfile.id,catalog:catalogType,category,search:query,cursor:page})+(listRetry?'&retry='+listRetry:'');
 catalogJson(url).then(d=>{if(ac.signal.aborted)return;if(catalogType==='xtream'&&d.catalog!=='xtream')throw Error('The IPTV channel list is not configured yet.');setGroups(d.groups?.length?d.groups:DEFAULT_GROUPS);setChannels(old=>page?[...new Map([...old,...d.items].map((c:Channel)=>[c.id,c])).values()]:d.items);setCursor(d.nextCursor==null?null:String(d.nextCursor));if(d.refreshing)refreshTimer=setTimeout(()=>setListRetry(n=>n+1),2500);}).catch(e=>{if(!ac.signal.aborted)setListError(e.message||'Unable to load channels.');}).finally(()=>{if(!ac.signal.aborted)setLoading(false);});
 return()=>{ac.abort();clearTimeout(refreshTimer);};
 },[category,query,page,listRetry,activeProfile?.id,activeProfile?.isKid,catalogType]);
 useEffect(()=>{
 if(!activeProfile||activeProfile.isKid)return;
 const controller=new AbortController();
 const historyKey=LAST_CHANNEL_KEY+':'+catalogType;
 let last:{id:string;name:string}|undefined;
 try{last=JSON.parse(localStorage.getItem(historyKey)||'null')||undefined;}catch{}
 const loadChannels=async(search='')=>{
   const params=new URLSearchParams({profileId:activeProfile.id,catalog:catalogType,category:'all',search});
   const result=await catalogJson('/api/live/channels?'+params);
   return catalogType==='public'||result.catalog==='xtream' ? result.items as Channel[] : [];
 };
 const names=[...new Set([last?.name,...(catalogType==='xtream'?IPTV_START_CHANNELS:PUBLIC_START_CHANNELS)])].filter((name):name is string=>!!name);
 const lookups=names.map(async name=>{
   const list=await loadChannels(name);
   return list.find(channel=>channel.id===last?.id) ??
     list.find(channel=>channel.name.toLowerCase()===name.toLowerCase()) ??
     (catalogType==='xtream' && IPTV_START_CHANNELS.includes(name) ? list.find(channel=>new RegExp('(?:^|[^a-z0-9])'+name.toLowerCase()+'(?:$|[^a-z0-9])').test(channel.name.toLowerCase())) : undefined);
 });
 void Promise.allSettled([...lookups,loadChannels().then(items=>items.slice(0,3))]).then(results=>{
   if(controller.signal.aborted||manualChoice.current)return;
   const candidates=results.flatMap(result=>result.status==='fulfilled'&&result.value?[result.value].flat():[]);
   const ordered=[...new Map(candidates.map(channel=>[channel.id,channel])).values()].slice(0,4);
   if(!ordered.length)return;
   automatic.current=ordered.slice(1);
   setSelected(ordered[0]);
 });
 return()=>controller.abort();
 },[activeProfile?.id,activeProfile?.isKid,catalogType]);
 useEffect(()=>{
 const sync=()=>setFullscreen(!!frameRef.current&&document.fullscreenElement===frameRef.current);
 document.addEventListener('fullscreenchange',sync);
 return()=>document.removeEventListener('fullscreenchange',sync);
 },[]);
 useEffect(()=>{
 const video=videoRef.current;if(!video||!selected||!activeProfile||activeProfile.isKid)return;
 const attempt=++playAttempt.current,ac=new AbortController();let engine:Hls|null=null,stopped=false,failed=false,stall:ReturnType<typeof setTimeout>|undefined;
 setConnecting(true);setError('');setLevels([]);setQuality(-1);setPaused(true);
 const current=()=>!stopped&&attempt===playAttempt.current;
 const fail=(message:string)=>{if(!current()||failed)return;failed=true;clearTimeout(stall);setConnecting(false);if(autoRetries.current<Math.min(24,selected.sources?.length||1)-1){autoRetries.current++;setSourceId('');setRetry(x=>x+1);}else {
   const next=automatic.current.shift();
   if(next){failedSources.current=[];autoRetries.current=0;setSourceId('');setSelected(next);}
   else setError(message);
 }};
 const clearStall=()=>{clearTimeout(stall);stall=undefined;};
 const wait=()=>{
   if(!current()||failed)return;
   setConnecting(true);
   stall??=setTimeout(()=>fail('The channel stopped responding. Retry or choose another version.'),20000);
 };
 const playing=()=>{clearStall();if(current()){setConnecting(false);setPaused(false);setError('');automatic.current=[];try{localStorage.setItem(LAST_CHANNEL_KEY+':'+catalogType,JSON.stringify({id:selected.id,name:selected.name}));}catch{}}};
 const mediaError=()=>fail('This stream is unavailable or cannot play on this device.');
 video.addEventListener('waiting',wait);video.addEventListener('playing',playing);video.addEventListener('error',mediaError);
 const requestTimer=setTimeout(()=>{if(current()){fail('The provider took too long. Please retry.');ac.abort();}},automatic.current.length?25000:70000);
 (async()=>{try{
 const r=await apiFetch('/api/live/play',{method:'POST',headers:{'Content-Type':'application/json'},signal:ac.signal,body:JSON.stringify({profileId:activeProfile.id,catalog:catalogType,contentId:selected.id,sourceId,excludeIds:failedSources.current})});const d=await r.json();clearTimeout(requestTimer);if(!current())return;failedSources.current=Array.isArray(d.attemptedIds)?d.attemptedIds:failedSources.current;if(!r.ok||!d.success)throw new Error(d.error||'No stream available.');if(!current())return;
 setActiveSource(d.sourceId||'');
 const url=resolveMediaUrl(d.streamUrl);const play=async()=>{if(!current())return;try{await video.play();}catch(e:any){
 if(!current())return;
 // Resolving a live feed can outlast the browser's tap activation. Start muted
 // when sound autoplay is denied, then let the viewer enable sound explicitly.
 if(e?.name==='NotAllowedError'&&!video.muted){video.muted=true;setMuted(true);try{await video.play();return;}catch{/* Keep an explicit Play control if autoplay is still denied. */}}
 if(current()){clearStall();setConnecting(false);setPaused(true);setControls(true);}
 }};wait();
 if(d.streamType==='mp4'){video.src=url;play();}
 else if(video.canPlayType('application/vnd.apple.mpegurl')&&(isIOSDevice(navigator)||!Hls.isSupported())){video.src=url;play();}
 else if(Hls.isSupported()){engine=new Hls({enableWorker:true,backBufferLength:30,maxBufferLength:20});hlsRef.current=engine;engine.attachMedia(video);engine.on(Hls.Events.MEDIA_ATTACHED,()=>engine?.loadSource(url));engine.on(Hls.Events.MANIFEST_PARSED,()=>{if(current())setLevels((engine?.levels||[]).map((l,index)=>({height:l.height,index})));play();});engine.on(Hls.Events.ERROR,(_,d)=>{if(d.fatal)fail('The live source failed. Try again or select another version.');});}
 else throw new Error('HLS playback is not supported on this browser.');
 }catch(e:any){clearTimeout(requestTimer);if(current()&&!ac.signal.aborted){fail(e.message||'Unable to play this channel.');}}})();
 return()=>{stopped=true;ac.abort();clearTimeout(requestTimer);clearTimeout(stall);video.removeEventListener('waiting',wait);video.removeEventListener('playing',playing);video.removeEventListener('error',mediaError);engine?.destroy();hlsRef.current=null;video.pause();video.removeAttribute('src');video.load();};
 },[selected?.id,retry,sourceId,activeProfile?.id,activeProfile?.isKid,catalogType]);
 useEffect(()=>()=>clearTimeout(hideTimer.current),[]);
 const showControls=()=>{setControls(true);clearTimeout(hideTimer.current);hideTimer.current=setTimeout(()=>{if(!videoRef.current?.paused)setControls(false);},3500);};
 const toggleFullscreen=async()=>{
  setFullscreenError('');
  try{
   if(document.fullscreenElement===frameRef.current)await document.exitFullscreen();
   else if(frameRef.current?.requestFullscreen)await frameRef.current.requestFullscreen();
   else {
    const video=videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?:()=>void })|null;
    if(!video?.webkitEnterFullscreen)throw new Error('Fullscreen unavailable');
    video.webkitEnterFullscreen();
   }
  }catch{setFullscreenError('Fullscreen is unavailable on this device.');}
 };
 const choose=(c:Channel)=>{manualChoice.current=true;automatic.current=[];setSourceId('');setActiveSource('');setSettingsOpen(false);autoRetries.current=0;failedSources.current=[];if(selected?.id===c.id)setRetry(n=>n+1);else setSelected(c);showControls();};
 const chooseSource=(id:string)=>{automatic.current=[];failedSources.current=[];autoRetries.current=0;setActiveSource('');setSourceId(id);setRetry(n=>n+1);};
 const changeCategory=(id:string)=>{setCategory(id);setPage('');setSearch('');setQuery('');};
 const playPause=()=>{const v=videoRef.current;if(!v||!selected)return;if(v.paused)v.play().catch(()=>setError('Tap Retry to reconnect.'));else v.pause();showControls();};
 const displayChannels=[...channels].sort((a,b)=>sort==='za'?b.name.localeCompare(a.name):sort==='favorites'?Number(favorites.includes(b.id))-Number(favorites.includes(a.id)):a.name.localeCompare(b.name));
 const now=selected?.epg?.find(p=>Date.parse(p.start)<=Date.now()&&Date.parse(p.end)>Date.now());
 if(activeProfile?.isKid)return <section className="tv-empty">Live TV is unavailable in Kids profiles.</section>;
 return <section ref={roomRef} className={`tv-room tv-cinema tv-smarters ${drawer?'tv-drawer-open':''}`} aria-label="Moro TV">
  <div className="tv-frame moro-web-tv" ref={frameRef} onPointerMove={showControls} onClick={showControls}>
   <video ref={videoRef} playsInline muted={muted} onPause={()=>setPaused(true)} onPlay={()=>{setPaused(false);showControls();}} aria-label={selected?.name||'Moro TV player'}/>
   {!selected&&<div className="tv-idle"><span className="tv-idle-symbol"><Radio size={30}/></span><h1>Moro TV</h1><p>Choose a channel to watch live.</p></div>}
   {connecting&&selected&&<div className="tv-player-message" role="status"><LoaderCircle className="tv-spin" size={28}/><span>Connecting to live…</span></div>}
   {fullscreenError&&<p className="moro-web-status" role="status" onClick={()=>setFullscreenError('')}>{fullscreenError}</p>}
   {error&&<div className="tv-player-message tv-player-error" role="alert"><p>{error}</p><button onClick={()=>{autoRetries.current=0;failedSources.current=[];setRetry(n=>n+1);}}><RotateCw size={16}/> Retry channel</button></div>}
   {selected&&<div className={`tv-overlay ${controls||paused||error||settingsOpen?'shown':''}`}>
    <header className="moro-web-bar">
     <div className="moro-web-heading"><h2>{selected.name}</h2>{now&&<p>{now.title}</p>}</div>
     <div className="moro-web-actions">
      <span className="tv-live-dot">LIVE</span>
      {!!selected.sources?.length&&<select className="moro-web-source" aria-label="Channel source" value={activeSource||sourceId||selected.sources[0].id} onChange={event=>chooseSource(event.target.value)}>
       {selected.sources.map((source,index)=><option key={source.id} value={source.id}>Source {index+1}</option>)}
      </select>}
      <div className="tv-settings-wrap">
       <button type="button" className="moro-web-button" aria-label="Playback settings" aria-expanded={settingsOpen} onClick={()=>setSettingsOpen(open=>!open)}><Settings size={19}/></button>
       {settingsOpen&&<div className="tv-settings-menu" onKeyDown={event=>{if(event.key==='Escape')setSettingsOpen(false);}}>
        <label htmlFor="tv-quality">Video quality</label>
        <select id="tv-quality" value={quality} onChange={event=>{const level=Number(event.target.value);setQuality(level);if(hlsRef.current)hlsRef.current.currentLevel=level;}}>
         <option value={-1}>Auto</option>
         {levels.map(level=><option key={level.index} value={level.index}>{level.height?level.height+'p':'Stream '+(level.index+1)}</option>)}
        </select>
       </div>}
      </div>
      <button type="button" className="moro-web-button" aria-label={favorites.includes(selected.id)?'Remove favorite':'Add favorite'} onClick={()=>toggleFavorite(selected.id)}><Heart size={19} fill={favorites.includes(selected.id)?'currentColor':'none'}/></button>
     </div>
    </header>
    <div className="tv-overlay-bottom"><div className="tv-controls">
     <button aria-label={paused?'Play':'Pause'} onClick={playPause}>{paused?<Play size={22}/>:<Pause size={22}/>}</button>
     <button aria-label={muted?'Unmute':'Mute'} onClick={()=>setMuted(!muted)}>{muted?<VolumeX size={21}/>:<Volume2 size={21}/>}</button>
     <button aria-label="Previous channel" disabled={!channels.length} onClick={()=>{const i=channels.findIndex(c=>c.id===selected.id);choose(channels[(i<0?channels.length-1:(i-1+channels.length)%channels.length)]);}}><ChevronUp size={21}/></button>
     <button aria-label="Next channel" disabled={!channels.length} onClick={()=>{const i=channels.findIndex(c=>c.id===selected.id);choose(channels[(i+1)%channels.length]);}}><ChevronDown size={21}/></button>
     <button aria-label="Channels" disabled={fullscreen} onClick={()=>setDrawer(d=>!d)}><List size={21}/></button>
     <input className="tv-volume" aria-label="Volume" type="range" min="0" max="1" step="0.05" defaultValue="1" onChange={e=>{if(videoRef.current){videoRef.current.volume=Number(e.target.value);setMuted(Number(e.target.value)===0);}}}/>
     <span className="tv-live-line" aria-hidden="true"><i/></span>
     
     <button aria-label={fullscreen?'Exit fullscreen':'Fullscreen'} onClick={()=>void toggleFullscreen()}>{fullscreen?<Minimize size={21}/>:<Maximize size={21}/>}</button>
    </div></div>
   </div>}
  </div>
  {!drawer&&<button className="tv-open-guide" aria-label="Open channel guide" onClick={()=>setDrawer(true)}><List size={20}/> Channels</button>}
  <div className="tv-browser" hidden={!drawer}>
   <div className="tv-guide-heading"><strong>Channels</strong><button aria-label="Close channel guide" onClick={()=>setDrawer(false)}><X size={20}/></button></div>
   {selected&&<div className="tv-now-card"><span className="tv-now-icon">{selected.name.slice(0,1)}</span><div><small>NOW PLAYING</small><strong>{selected.name}</strong><p>{now?.title||'No programme information'}</p></div></div>}
   <div className="tv-channel-pane"><div className="tv-search"><Search size={16}/><input aria-label="Search channels" placeholder="Find a channel" value={search} onChange={e=>setSearch(e.target.value)}/><button aria-label="Refresh channels" onClick={()=>setListRetry(n=>n+1)}><RotateCw size={15}/></button></div>

    <div className="tv-guide-filters"><select aria-label="Sort channels" value={sort} onChange={e=>setSort(e.target.value)}><option value="az">A–Z</option><option value="za">Z–A</option><option value="favorites">Favorites first</option></select><select aria-label="Channel category or country" value={category} onChange={e=>changeCategory(e.target.value)}>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
    <div className="tv-list-label"><span>{groups.find(g=>g.id===category)?.name||'Channels'}</span><small>{channels.length}{cursor?'+':''}</small></div>
    <div className="tv-channel-list" aria-label="Channels">
     {displayChannels.map((c,index)=>{const programme=c.epg?.find(p=>Date.parse(p.start)<=Date.now()&&Date.parse(p.end)>Date.now());const progress=programme?Math.min(100,Math.max(0,(Date.now()-Date.parse(programme.start))/(Date.parse(programme.end)-Date.parse(programme.start))*100)):0;return <div key={c.id} className={`tv-channel ${selected?.id===c.id?'selected':''}`}><button className="tv-channel-select" onClick={()=>choose(c)} aria-pressed={selected?.id===c.id}><span className="tv-row-number">{index+1}</span><span className="tv-row-icon" style={{background:`hsl(${index*47%360} 35% 40%)`}}>{c.logoUrl?<img src={c.logoUrl} alt="" loading="lazy" onError={e=>{e.currentTarget.style.visibility='hidden';}}/>:c.name.slice(0,1)}</span><span className="tv-channel-copy"><strong>{c.name}</strong><small>{programme?`${new Date(programme.start).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} · ${programme.title}`:c.category}</small>{programme&&<span className="tv-programme-progress"><i style={{width:progress+'%'}}/></span>}</span>{favorites.includes(c.id)&&<Heart size={15} fill="currentColor"/>}</button></div>;})}
     {loading&&<div className="tv-list-status" role="status"><LoaderCircle size={18} className="tv-spin"/> Loading channels…</div>}
     {listError&&<div className="tv-list-status" role="alert"><p>{listError}</p><button onClick={()=>setListRetry(n=>n+1)}>Try again</button></div>}
     {!loading&&!listError&&!channels.length&&<div className="tv-list-status">{category==='usa'?'No USA channels are currently listed by this provider.':'No channels found in this category.'}</div>}
     {cursor&&!loading&&!listError&&<button className="tv-more" onClick={()=>setPage(cursor)}>More channels <ChevronDown size={15}/></button>}
    </div>
   </div>
   <aside className="tv-category-rail">    <div className="tv-search"><Search size={16}/><input aria-label="Search categories" placeholder="Categories" value={categorySearch} onChange={e=>setCategorySearch(e.target.value)}/></div><nav className="tv-categories" aria-label="TV categories">{groups.filter(g=>g.name.toLowerCase().includes(categorySearch.toLowerCase())).map(g=><button key={g.id} aria-pressed={category===g.id} onClick={()=>changeCategory(g.id)}><span>{g.name}</span><b>{g.count??g.badge}</b></button>)}</nav></aside>
  </div>
 </section>;
}

