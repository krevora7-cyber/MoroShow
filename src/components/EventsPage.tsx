import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Hls from 'hls.js';
import {ArrowLeft,CalendarDays,ChevronRight,Clock3,Play,Radio,RefreshCw} from 'lucide-react';
import {decodeMatchFeed} from '../events/decodeMatchFeed';
import './EventsPage.css';

type Team={name?:string;name_ar?:string;logo?:string;score?:number|null};
type Match={id:number;date?:string;time?:string;status?:number;active?:number;has_channels?:number;home?:Team;away?:Team;league?:{name?:string;name_ar?:string}};
type Feed={matches?:Match[]};
type Source={type?:string;link?:string;server_name?:string};
type Detail={match?:{channels?:Source[]};channels?:Source[]};
const API='https://cdn.kora-api.org/api/v1/';
const asset=(p?:string)=>p&&/^uploads\/[a-zA-Z0-9_./-]+$/.test(p)?`https://cdn.kora-api.org/${p}`:undefined;
const name=(t?:Team)=>t?.name_ar||t?.name||'—';
const status=(m:Match)=>Number(m.status)===1||Number(m.status)===3?'Live':Number(m.status)===2?'Finished':'Upcoming';
const rank=(m:Match)=>status(m)==='Live'?0:status(m)==='Upcoming'?1:2;
const matchTime=(m:Match)=>{if(!m.date||!m.time)return m.time||'Time unavailable';const value=new Date(`${m.date}T${m.time.length===5?m.time+':00':m.time}Z`);return Number.isNaN(value.getTime())?m.time:value.toLocaleString(undefined,{hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'});};
function sourceUrl(s:Source):string{
 if((s.type||'').toUpperCase()!=='HLS'||!s.link)return '';
 try{const u=new URL(s.link),host=u.hostname.toLowerCase();if(u.protocol!=='https:'||u.username||u.password||!host.includes('.')||/^[0-9.]+$/.test(host)||host.includes(':')||host==='localhost'||/\.(localhost|local|internal)$/.test(host))return '';return u.href;}catch{return '';}
}
export default function EventsPage(){
 const [matches,setMatches]=useState<Match[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[selected,setSelected]=useState<Match|null>(null);
 const [sources,setSources]=useState<string[]>([]),[sourceIndex,setSourceIndex]=useState(0),[detailLoading,setDetailLoading]=useState(false),[playbackError,setPlaybackError]=useState('');
 const video=useRef<HTMLVideoElement>(null),player=useRef<HTMLElement>(null);
 const load=useCallback(async(signal?:AbortSignal)=>{
  try{const response=await fetch(API+'matches',{signal,headers:{Accept:'application/json'}});if(!response.ok)throw new Error('Events are temporarily unavailable.');const feed:Feed|Match[]=await decodeMatchFeed(await response.text());if(signal?.aborted)return;const list=Array.isArray(feed)?feed:feed.matches;if(!Array.isArray(list))throw new Error('Events are temporarily unavailable.');setMatches(list.slice().sort((a,b)=>rank(a)-rank(b)));setError('');}
  catch(e:any){if(!signal?.aborted)setError(e?.message||'Unable to load events.');}finally{if(!signal?.aborted)setLoading(false);}
 },[]);
 useEffect(()=>{const c=new AbortController();void load(c.signal);const timer=setInterval(()=>{if(!document.hidden)void load(c.signal);},60000);return()=>{c.abort();clearInterval(timer);};},[load]);
 useEffect(()=>{if(!selected)return;const c=new AbortController();setSources([]);setSourceIndex(0);setPlaybackError('');setDetailLoading(true);
  (async()=>{try{const r=await fetch(`${API}matche/${encodeURIComponent(selected.id)}`,{signal:c.signal,headers:{Accept:'application/json'}});if(!r.ok)throw new Error('Could not load this event.');const detail:Detail=await decodeMatchFeed(await r.text());if(c.signal.aborted)return;const links=(detail.match?.channels||detail.channels||[]).map(sourceUrl).filter(Boolean);setSources([...new Set(links)]);if(!links.length)setPlaybackError('A compatible live source is not available for this event.');}catch(e:any){if(!c.signal.aborted)setPlaybackError(e?.message||'Could not load this event.');}finally{if(!c.signal.aborted)setDetailLoading(false);}})();return()=>c.abort();},[selected?.id]);
 useEffect(()=>{const v=video.current,source=sources[sourceIndex];if(!v||!source)return;let hls:Hls|null=null,disposed=false;setPlaybackError('');
  const onError=()=>{if(!disposed)setPlaybackError('This source could not play. Try another source or retry later.');};v.addEventListener('error',onError);
  if(v.canPlayType('application/vnd.apple.mpegurl')){v.src=source;void v.play().catch(()=>{});}else if(Hls.isSupported()){hls=new Hls();hls.loadSource(source);hls.attachMedia(v);hls.on(Hls.Events.MANIFEST_PARSED,()=>{if(!disposed)void v.play().catch(()=>{});});hls.on(Hls.Events.ERROR,(_,d)=>{if(d.fatal)onError();});}else setPlaybackError('This device cannot play this live source.');
  return()=>{disposed=true;v.removeEventListener('error',onError);hls?.destroy();v.pause();v.removeAttribute('src');v.load();};
 },[sources,sourceIndex]);
 const liveCount=useMemo(()=>matches.filter(m=>status(m)==='Live').length,[matches]);
 const pick=(m:Match)=>{setSelected(m);window.setTimeout(()=>player.current?.scrollIntoView({behavior:'smooth',block:'start'}),0);};
 const image=(team?:Team)=>asset(team?.logo)?<img src={asset(team?.logo)} alt="" loading="lazy"/>:<span aria-hidden="true">—</span>;
 return <section className="ms-events" aria-label="Events">
  <header className="ms-events-header"><div><p className="ms-events-kicker"><span/> MOROSHOW SPORT</p><h1>Events</h1><p>Live moments, all in one place.</p></div><button className="ms-events-refresh" aria-label="Refresh events" onClick={()=>{setLoading(true);void load();}}><RefreshCw size={17} className={loading?'ms-events-spin':''}/><span>Refresh</span></button></header>
  {selected&&<section className="ms-events-player" ref={player} aria-label="Selected event"><div className="ms-events-player-top"><button className="ms-events-back" onClick={()=>setSelected(null)}><ArrowLeft size={18}/> All events</button><span className={'ms-events-status '+(status(selected)==='Live'?'is-live':'')}>{status(selected)}</span></div><div className="ms-events-match-heading"><div><p>{selected.league?.name_ar||selected.league?.name||'Sport'}</p><h2 dir="auto">{name(selected.home)} <span>vs</span> {name(selected.away)}</h2></div><span className="ms-events-player-time"><Clock3 size={15}/> {matchTime(selected)}</span></div><div className="ms-events-video">{sources.length>0?<video key={sources[sourceIndex]} ref={video} controls muted playsInline aria-label="Event video player"/>:<div className="ms-events-video-empty"><span className="ms-events-video-icon"><Radio size={26}/></span><strong>{detailLoading?'Connecting to event':'Live playback unavailable'}</strong><p>{detailLoading?'Finding an available source…':playbackError||'A compatible live source is not available for this event.'}</p></div>}</div>{sources.length>0&&<><div className="ms-events-sources"><span>Sources</span>{sources.map((s,i)=><button key={s} onClick={()=>setSourceIndex(i)} aria-pressed={sourceIndex===i}>Source {i+1}</button>)}</div>{playbackError&&<p className="ms-events-error" role="alert">{playbackError}</p>}</>}</section>}
  <div className="ms-events-section-title"><div><p className="ms-events-kicker">MATCH CENTRE</p><h2>Today’s events</h2></div><span className="ms-events-count"><i/> {liveCount} live</span></div>
  {error&&<p className="ms-events-error" role="alert">{error}</p>}
  {loading&&!matches.length?<p className="ms-events-empty" role="status">Loading events…</p>:!matches.length&&!error?<div className="ms-events-empty"><CalendarDays size={24}/><strong>No events right now</strong><span>Check back later for new matches.</span></div>:<div className="ms-events-grid">{matches.map(m=>{const state=status(m),available=Number(m.active)===1&&Number(m.has_channels)===1;return <button className="ms-event-card" key={m.id} disabled={!available} onClick={()=>pick(m)} aria-label={`${name(m.home)} vs ${name(m.away)}${available?', view event':''}`}><div className="ms-event-card-top"><span className="ms-event-league">{m.league?.name_ar||m.league?.name||'Sport'}</span><span className={'ms-events-status '+(state==='Live'?'is-live':'')}>{state}</span></div><div className="ms-event-teams"><div className="ms-event-team">{image(m.home)}<strong dir="auto">{name(m.home)}</strong></div><div className="ms-event-score">{m.home?.score!=null&&m.away?.score!=null?<strong>{m.home.score}<span>:</span>{m.away.score}</strong>:<strong>VS</strong>}<small>{matchTime(m)}</small></div><div className="ms-event-team">{image(m.away)}<strong dir="auto">{name(m.away)}</strong></div></div><div className="ms-event-footer"><span>{available?<><Play size={14} fill="currentColor"/> View event</>:<><Clock3 size={14}/> Not available</>}</span><ChevronRight size={16}/></div></button>})}</div>}
 </section>;
}
