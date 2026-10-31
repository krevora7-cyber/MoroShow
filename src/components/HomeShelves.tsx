import {useEffect,useRef,useState} from 'react';
import {HOME_SHELVES} from '../homeShelves';
import {useProfile} from '../context/ProfileContext';
import {useCatalog} from '../context/CatalogContext';
import {catalogJson} from '../player/catalogCache';
import {ContentRow} from './ContentRow';
import type {CatalogItem} from '../types';
export function HomeShelves(){const {activeProfile}=useProfile();return <>{HOME_SHELVES.filter(s=>!activeProfile?.isKid||('kids' in s&&s.kids)).map(s=><Shelf key={`${s.id}:${activeProfile?.id}:${activeProfile?.isKid}`} id={s.id} title={s.title} numbered={'numbered' in s&&s.numbered}/>)}</>}
function Shelf({id,title,numbered}:{id:string;title:string;numbered:boolean}){const host=useRef<HTMLDivElement>(null);const {activeProfile}=useProfile();const {rememberSourceItems}=useCatalog();const [near,setNear]=useState(false),[items,setItems]=useState<CatalogItem[]>([]),[error,setError]=useState(''),[retry,setRetry]=useState(0),[loaded,setLoaded]=useState(false);
 useEffect(()=>{const observer=new IntersectionObserver(([e])=>{if(e.isIntersecting){setNear(true);observer.disconnect();}},{rootMargin:'450px'});if(host.current)observer.observe(host.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{if(!near||!activeProfile)return;let cancelled=false;setError('');catalogJson(`/api/web-sources/home/${id}?profileId=${activeProfile.id}&kids=${activeProfile.isKid?1:0}&retry=${retry}`,!activeProfile.isKid).then(d=>{if(!cancelled){setItems(d.items);rememberSourceItems(d.items);setLoaded(true);}}).catch(()=>{if(!cancelled)setError('Could not load this collection.');});return()=>{cancelled=true;};},[near,retry]);
 return <div ref={host} className={!loaded?'m-shelf-placeholder':undefined}>{items.length?<ContentRow title={title} items={items} numbered={numbered}/>:error?<div className="m-notice"><h2>{title}</h2><p>{error}</p><button onClick={()=>setRetry(n=>n+1)}>Retry collection</button></div>:loaded?null:<div className="m-row"><h2>{title}</h2><div className="m-shelf-skeleton" aria-label={`Loading ${title}`}/></div>}</div>;
}
