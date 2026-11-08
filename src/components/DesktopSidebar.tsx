import {useEffect,useRef,useState} from 'react';
import {Search,Home,Clapperboard,Film,Library,Settings,Plus,Check,ChevronLeft,Sparkles,Download} from 'lucide-react';
import {useCatalog} from '../context/CatalogContext';
import {useProfile} from '../context/ProfileContext';
import {AVATAR_OPTIONS} from '../types';
const image=(id?:string)=>(AVATAR_OPTIONS.find(a=>a.id===id)||AVATAR_OPTIONS[0]).image;
export function DesktopSidebar(){
 const {activeTab,setActiveTab,setIsSettingsOpen,setEditingProfileId,setIsProfileEditOpen,stopPlayback}=useCatalog();
 const {activeProfile,profiles,selectProfile}=useProfile();
 const [hovered,setHovered]=useState(false),[keyboardFocus,setKeyboardFocus]=useState(false);const [switching,setSwitching]=useState(false),[clock,setClock]=useState(new Date());const root=useRef<HTMLElement>(null);
 useEffect(()=>{const timer=setInterval(()=>setClock(new Date()),60000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setSwitching(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[]);
 useEffect(()=>{const keys=(e:KeyboardEvent)=>{
  if(!matchMedia('(min-width:641px)').matches||e.altKey||e.metaKey||e.ctrlKey)return;
  const target=document.activeElement as HTMLElement|null;
  if(target?.matches('input,textarea,select,[contenteditable=true]')||document.querySelector('[role=dialog],.m-player,.m-overlay,.ms-player'))return;
  if(e.key==='Escape'&&switching){setSwitching(false);root.current?.querySelector<HTMLButtonElement>('.m-sidebar-user')?.focus();return;}
  if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
  const candidates=Array.from(document.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],[tabindex="0"]')).filter(el=>{const r=el.getBoundingClientRect();return !el.closest('[inert],[hidden]')&&r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden';});
  if(!target||!candidates.includes(target)){e.preventDefault();root.current?.querySelector<HTMLButtonElement>('nav button[aria-current],nav button')?.focus();return;}
  const a=target.getBoundingClientRect(),x=a.x+a.width/2,y=a.y+a.height/2;let best:HTMLElement|undefined,score=Infinity;
  for(const el of candidates){if(el===target)continue;const b=el.getBoundingClientRect(),dx=b.x+b.width/2-x,dy=b.y+b.height/2-y;const horizontal=e.key==='ArrowLeft'||e.key==='ArrowRight';const forward=e.key==='ArrowLeft'?-dx:e.key==='ArrowRight'?dx:e.key==='ArrowUp'?-dy:dy;if(forward<4)continue;const across=Math.abs(horizontal?dy:dx);const value=forward+across*3;if(value<score){score=value;best=el;}}
  if(best){e.preventDefault();best.focus({preventScroll:true});best.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});}
 };document.addEventListener('keydown',keys);return()=>document.removeEventListener('keydown',keys);},[switching]);
 const go=(tab:typeof activeTab)=>{setSwitching(false);setActiveTab(tab);window.scrollTo(0,0);};
 const items=[['search','Search',Search],['home','Home',Home],['live','Events',null],['movies','Movies',Film],['series','Shows',Clapperboard],['anime','Anime',Sparkles],['clips','Shorts',Clapperboard],['favorites','My Moro',Library],['downloads','Downloads',Download]] as const;
 return <aside className={`m-tv-sidebar ${hovered||keyboardFocus||switching?'is-expanded':''}`} onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>{setHovered(false);if(!keyboardFocus)setSwitching(false);}} onFocus={e=>{if(e.target.matches(':focus-visible'))setKeyboardFocus(true);}} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node)){setKeyboardFocus(false);setSwitching(false);}}} ref={root} aria-label="MoroShow sidebar"><button className="m-sidebar-user" aria-label="Switch profile" aria-expanded={switching} aria-controls="m-sidebar-profiles" onClick={()=>setSwitching(v=>!v)}><img src={image(activeProfile?.avatar)} alt=""/><strong>{activeProfile?.name||'My Moro'}</strong><time>{clock.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</time></button>
 {switching?<section className="m-sidebar-profiles" id="m-sidebar-profiles" aria-label="Switch profile"><button className="m-sidebar-back" onClick={()=>setSwitching(false)}><ChevronLeft size={18}/>Switch Users</button><div className="m-sidebar-profile-grid">{profiles.map(p=><button key={p.id} aria-label={'Switch to '+p.name} aria-pressed={p.id===activeProfile?.id} onClick={()=>{stopPlayback();selectProfile(p);setSwitching(false);}}><span><img src={image(p.avatar)} alt=""/>{p.id===activeProfile?.id&&<i><Check size={15}/></i>}</span><strong>{p.name}</strong></button>)}<button onClick={()=>{setEditingProfileId(null);setIsProfileEditOpen(true);setSwitching(false);}}><span className="m-sidebar-add"><Plus size={32}/></span><strong>Add Profile</strong></button></div></section>:<><nav aria-label="Desktop navigation">{items.filter(([id])=>id!=='live'||!activeProfile?.isKid).map(([id,label,Icon])=><button key={id} aria-label={label} aria-current={activeTab===id?'page':undefined} onClick={()=>go(id)}>{Icon?<span className="m-sidebar-icon"><Icon size={19}/></span>:<span className="m-moro-tv-icon"><img src="/moro-arch.svg" alt=""/><b>tv</b></span>}<span>{label}</span></button>)}</nav><div className="m-sidebar-bottom"><button onClick={()=>setIsSettingsOpen(true)}><Settings size={18}/><span>Account & Settings</span></button><button className="m-sidebar-brand" onClick={()=>go('home')}><img src="/moro-arch.svg" alt=""/><span>MOROSHOW</span></button></div></>}
 </aside>;
}
