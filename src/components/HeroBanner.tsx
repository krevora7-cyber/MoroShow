import {Swiper,SwiperSlide} from 'swiper/react';
import {EffectCards,EffectFade} from 'swiper/modules';
import type {Swiper as SwiperType} from 'swiper';
import 'swiper/css';
import 'swiper/css/effect-cards';
import 'swiper/css/effect-fade';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Play,Plus,Check,Info} from 'lucide-react';
import {useCatalog} from '../context/CatalogContext';
import {useProfile} from '../context/ProfileContext';
import {catalogJson} from '../player/catalogCache';
import {HeroTrailer} from './HeroTrailer';
import type {CatalogItem} from '../types';
export function HeroBanner({entries,clips=false}:{entries?:CatalogItem[];clips?:boolean}){
 const {movies,series,startPlayback,setSelectedSeries,activePlayback,selectedSeries,pendingPlayback}=useCatalog();const {activeProfile,isWhoIsWatchingOpen,favorites,toggleFavorite}=useProfile();
 const [netflix,setNetflix]=useState<CatalogItem[]>([]);useEffect(()=>{if(clips||!activeProfile)return;let cancelled=false;catalogJson('/api/web-sources/hero/netflix?'+new URLSearchParams({profileId:activeProfile.id,kids:activeProfile.isKid?'1':'0'}),!activeProfile.isKid).then(d=>{if(!cancelled)setNetflix(d.items);}).catch(()=>{});return()=>{cancelled=true;};},[clips,activeProfile?.id,activeProfile?.isKid]);
 const list=useMemo(()=>clips?entries?.slice(0,6)||[]:netflix, [entries,netflix,clips]);

 const [elapsed,setElapsed]=useState(0);
 const [slide,setSlide]=useState(0),[art,setArt]=useState<any>({}),[inView,setInView]=useState(false),[visible,setVisible]=useState(!document.hidden);
 const swiper=useRef<SwiperType|null>(null);
 const host=useRef<HTMLElement>(null),current=list[slide%Math.max(1,list.length)];
 const [autoTrailer,setAutoTrailer]=useState(()=>localStorage.getItem('moro-trailer-autoplay')!=='off');useEffect(()=>{const update=()=>setAutoTrailer(localStorage.getItem('moro-trailer-autoplay')!=='off');window.addEventListener('moro-preferences',update);return()=>window.removeEventListener('moro-preferences',update);},[]);
 const enabled=inView&&visible&&!activePlayback&&!selectedSeries&&!pendingPlayback&&!isWhoIsWatchingOpen;
 useEffect(()=>{setSlide(0);swiper.current?.slideTo(0);},[activeProfile?.id,clips]);
 useEffect(()=>{const ob=new IntersectionObserver(([e])=>setInView(e.isIntersecting&&e.intersectionRatio>=.4),{threshold:[0,.4]});if(host.current)ob.observe(host.current);const change=()=>setVisible(!document.hidden);document.addEventListener('visibilitychange',change);return()=>{ob.disconnect();document.removeEventListener('visibilitychange',change);};},[list.length]);
 useEffect(()=>{setElapsed(0);if(!enabled||clips)return;const start=performance.now();const t=setInterval(()=>setElapsed(Math.min(1,(performance.now()-start)/18000)),100);return()=>clearInterval(t);},[slide,enabled,clips]);
 useEffect(()=>{if(!enabled||list.length<2||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const t=setInterval(()=>{const sw=swiper.current;if(sw)sw.activeIndex>=list.length-1?sw.slideTo(0):sw.slideNext();},18000);return()=>clearInterval(t);},[enabled,list.length,clips?0:slide]);
 if(!current)return <div className="m-hero-empty">Discover your next favourite.</div>;
 const trailer=clips?art.trailerId||current.trailerId:current.trailerId||art.trailerId;
 return <section ref={host} className={`m-hero-deck ${clips?'m-hero-deck-clips':'m-hero-cinema'}`} aria-label="Featured titles" aria-roledescription="carousel">
 <Swiper modules={[EffectCards,EffectFade]} effect={clips?"cards":"fade"} fadeEffect={{crossFade:true}} grabCursor cardsEffect={{slideShadows:false,perSlideRotate:2,perSlideOffset:8}} speed={matchMedia('(prefers-reduced-motion: reduce)').matches?0:750} onSwiper={s=>{swiper.current=s;}} onSlideChange={s=>setSlide(s.activeIndex)} className="m-hero-swiper" spaceBetween={clips?0:14}>
 {list.map((entry,n)=><SwiperSlide key={entry.id}><div inert={n!==slide} className={`m-hero ${clips?'m-hero-clips':''}`}>
 <picture><source media="(max-width: 640px)" srcSet={entry.logoUrl||entry.backdropUrl}/><img src={(n===slide?art.backdropUrl:undefined)||entry.backdropUrl||entry.logoUrl} alt="" fetchPriority={n===0?'high':'auto'} loading={n===0?'eager':'lazy'}/></picture>
 {n===slide&&trailer&&enabled&&autoTrailer&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&<HeroTrailer id={trailer} name={entry.name}/>}
 <div className="m-hero-shade"/><div className="m-hero-copy"><p className="m-eyebrow">{clips?'SHORT STORIES. BIG FEELINGS.':activeProfile?.isKid?'MADE FOR LITTLE EXPLORERS':'YOUR NEXT GREAT WATCH'}</p><h1>{entry.name}</h1><p className="m-hero-meta">{entry.year&&`${entry.year} · `}{entry.ageRating&&`${entry.ageRating} · `}{entry.category}</p><p className="m-hero-overview">{(n===slide?art.overview:undefined)||entry.overview}</p><div className="m-hero-actions"><button className="m-primary" onClick={()=>entry.kind==='series'?setSelectedSeries(entry):startPlayback(entry)}><Play size={20} fill="currentColor"/>Play</button><button className="m-secondary" onClick={()=>toggleFavorite(entry.id)}>{favorites.includes(entry.id)?<Check size={21}/>:<Plus size={21}/>}{clips?'My List':'My Moro'}</button><button className="m-icon" aria-label="Title details" onClick={()=>setSelectedSeries(entry)}><Info size={23}/></button></div></div>
</div></SwiperSlide>)}
 </Swiper>
 <div className="m-hero-bottom"><div className={clips?"m-dots":"m-tod-thumbnails"}>{list.map((i,n)=><button key={i.id} className={n===slide%list.length?'selected':''} onClick={()=>swiper.current?.slideTo(n)} aria-label={`Show ${i.name}`}>{!clips&&<><img src={i.backdropUrl||i.logoUrl} alt=""/><span>{i.name}</span><i style={{transform:`scaleX(${n===slide?elapsed:0})`}}/></>}</button>)}</div></div></section>;
}
