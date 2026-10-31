import {Plus,Check} from 'lucide-react';
import {useCatalog} from '../context/CatalogContext';
import {useProfile} from '../context/ProfileContext';
import {PosterArtwork} from './PosterArtwork';
import type {CatalogItem} from '../types';
export function MediaTile({item}:{item:CatalogItem}){const {setSelectedSeries}=useCatalog();const {favorites,toggleFavorite}=useProfile();const saved=favorites.includes(item.id);return <article className="m-tile"><button className="m-poster" onClick={()=>setSelectedSeries(item)} aria-label={`Details for ${item.name}`}><PosterArtwork item={item} className="w-full h-full"/>{item.ageRating&&<span className="m-rating">{item.ageRating}</span>}</button><div className="m-tile-caption"><div><h3>{item.name}</h3><p>{item.year?item.year+' · ':''}{item.category}</p></div><button aria-label={saved?'Remove from My List':'Add to My List'} onClick={()=>toggleFavorite(item.id)}>{saved?<Check size={17}/>:<Plus size={17}/>}</button></div></article>}
