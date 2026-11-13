import {prepareShort} from './shortsPreparation';
import {compatibilityLease,registerShortsCompatibility} from './shortsCompatibility';
import {dramaCatalog,dramaDetails,resolveDramaEpisodeSource,discoverDramaEpisodeSubtitles,parseDramaIdentity} from './dramaSource';
import {randomUUID} from 'node:crypto';
import {mediaLease,subtitleLease,registerDramaMedia} from './dramaPlayback';
import type { Express, Request } from 'express';
import type { CatalogItem } from '../types';
import { db } from './db';
import { directVodOptions, resolveDirectVod } from './directVod';
export const EMBED_SERVERS = [
 {id:'vidstuck',name:'Vidstuck',origin:'https://vidstuck.cc',prefix:'/embed'},
 {id:'videasy',name:'Videasy',origin:'https://player.videasy.ws',prefix:'/embed'},
 {id:'cinesrc',name:'CineSrc',origin:'https://cinesrc.st',prefix:'/embed'},
 {id:'cinezo',name:'Source 2',origin:'https://player.cinezo.live',prefix:'/embed'},
 {id:'vidsrc-mov',name:'Source 3',origin:'https://vidsrc.mov',prefix:'/embed'},
 {id:'vidlink',name:'Source 4',origin:'https://vidlink.pro',prefix:''},
 {id:'vidsrc-sh',name:'Source 5',origin:'https://vidsrc.sh',prefix:'/embed'},
] as const;
export function embedUrl(server:string,type:string,id:number,season?:number,episode?:number){
 const p=EMBED_SERVERS.find(x=>x.id===server);
 if(!p||!['movie','tv'].includes(type)||!Number.isSafeInteger(id)||id<1)throw new Error('Invalid player selection');
 if(type==='tv'&&![season,episode].every(n=>Number.isSafeInteger(n)&&n!>0))throw new Error('Select an episode first');
 if(server==='vidstuck')return `${p.origin}/embed/${type}/${id}${type==='tv'?`/${season}/${episode}`:''}?branding=MoroShow&color=ed2939`;
 if(server==='cinesrc')return `${p.origin}/embed/${type}/${id}?autoplay=false&autonext=false${type==='tv'?`&s=${season}&e=${episode}`:''}`;
 return `${p.origin}${p.prefix}/${type}/${id}${type==='tv'?`/${season}/${episode}`:''}`;
}
const cache=new Map<string,{expires:number;data:any}>(),inflight=new Map<string,Promise<any>>();
export function clearSourceCache(){cache.clear();inflight.clear();}
async function tmdb(path:string,params:Record<string,string>={}){
 const key=process.env.TMDB_API_KEY?.trim();if(!key)throw new Error('Add TMDB_API_KEY to .env and restart MoroShow.');
 const ck=path+JSON.stringify(params),hit=cache.get(ck);if(hit&&hit.expires>Date.now())return hit.data;
 if(!inflight.has(ck))inflight.set(ck,(async()=>{
 const url=new URL('https://api.themoviedb.org/3/'+path);for(const [k,v]of Object.entries({language:'en-US',...params}))url.searchParams.set(k,v);
 const headers:Record<string,string>={};if(key.includes('.'))headers.Authorization='Bearer '+key;else url.searchParams.set('api_key',key);
 const r=await fetch(url,{headers,signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`Catalog returned HTTP ${r.status}`);
 const data=await r.json();if(cache.size>=600)cache.delete(cache.keys().next().value!);cache.set(ck,{data,expires:Date.now()+900000});return data;
 })().finally(()=>inflight.delete(ck)));return inflight.get(ck)!;
}
export function kidsRating(d:any,type:'movie'|'tv'):string|undefined{
 if(d.adult)return;
 const ratings:string[]=(type==='movie'?(d.release_dates?.results||[]).filter((x:any)=>x.iso_3166_1==='US').flatMap((x:any)=>(x.release_dates||[]).map((r:any)=>r.certification)):(d.content_ratings?.results||[]).filter((x:any)=>x.iso_3166_1==='US').map((x:any)=>x.rating)).filter((x:any)=>typeof x==='string'&&x.trim()).map((x:string)=>x.trim());
 const safe=type==='movie'?['G','PG']:['TV-Y','TV-Y7','TV-Y7-FV','TV-G','TV-PG'];
 return ratings.length&&ratings.every(x=>safe.includes(x))?ratings[0]:undefined;
}
const img=(path?:string,size='w500')=>path?`https://image.tmdb.org/t/p/${size}${path}`:undefined;
export function toMovie(x:any,type:'movie'|'tv',kid=false):CatalogItem{
 const genres=x.genre_ids||x.genres?.map((g:any)=>g.id)||[];
 return {id:`w32:${type}:${x.id}`,name:x.title||x.name,streamUrl:'',streamType:'hls',kind:type==='tv'?'series':'movie',category:genres.includes(16)?'Anime':type==='tv'?'Series':'Movies',seriesTitle:type==='tv'?x.name:undefined,isKidFriendly:kid,kidsVerified:kid,ageRating:kid?kidsRating(x,type):undefined,genreIds:genres,logoUrl:img(x.poster_path),backdropUrl:img(x.backdrop_path,'w1280'),overview:x.overview||'',year:Number((x.release_date||x.first_air_date||'').slice(0,4))||undefined,ratingBadge:Number(x.vote_average||0).toFixed(1)};
}
function profile(req:Request){const p=db.getProfileById(String(req.query.profileId||req.body?.profileId||''));if(!p)throw new Error('Select a profile first');return p;}
function number(x:unknown,fallback=1,max=500){const n=Number(x??fallback);if(!Number.isSafeInteger(n)||n<1||n>max)throw new Error('Invalid page or episode');return n;}
function webId(raw:string){const m=/^w32:(movie|tv):(\d+)(?::(\d+):(\d+))?$/.exec(raw);if(!m)throw new Error('Invalid title');return {type:m[1] as 'movie'|'tv',id:number(m[2],1,2147483647),season:m[3]?number(m[3]):undefined,episode:m[4]?number(m[4],1,5000):undefined};}
async function allowed(id:ReturnType<typeof webId>,kid:boolean){const d=await tmdb(`${id.type}/${id.id}`,{append_to_response:id.type==='movie'?'videos,release_dates,credits,recommendations':'videos,content_ratings,credits,recommendations'});if(d.adult)throw new Error('This title is unavailable');if(kid&&!kidsRating(d,id.type))throw new Error('No verified under-13 rating for this title');return d;}
async function catalog(type:'movie'|'tv',page:number,q:string,kid:boolean,animation:boolean,shelf?:string){
 const params:Record<string,string>={page:String(page),include_adult:'false'};let path=`${type}/popular`;
 if(q){path=`search/${type}`;params.query=q;}else if(animation||kid){path=`discover/${type}`;params.sort_by='popularity.desc';if(animation)params.with_genres='16';if(kid&&type==='movie')Object.assign(params,{certification_country:'US','certification.lte':'PG'});if(kid&&type==='tv'&&!animation)params.with_genres='16|10762|10751';}
 if(shelf){
 const filters:Record<string,Record<string,string>>={asian:{with_origin_country:'JP|KR|CN|HK|TW|TH|IN'},horror:{with_genres:'27'},romance:{with_genres:'10749'},action:{with_genres:'28|12'},comedy:{with_genres:'35'},scifi:{with_genres:'878'},crime:{with_genres:'80|9648'},korean:{with_origin_country:'KR'},family:{with_genres:'10751'},documentary:{with_genres:'99'}};
 if(shelf==='top10'){path=`discover/${type}`;Object.assign(params,{with_watch_providers:'8',watch_region:'MA',with_watch_monetization_types:'flatrate',sort_by:'popularity.desc'});}
 else {if(!filters[shelf])throw new Error('Unknown collection');path=`discover/${type}`;Object.assign(params,{sort_by:'popularity.desc',...filters[shelf]});}
 }
 const d=await tmdb(path,params);const rows=(d.results||[]).filter((x:any)=>!x.adult&&(!animation||(x.genre_ids||[]).includes(16)));let items:CatalogItem[]=[];
 if(kid){for(let i=0;i<rows.length;i+=5){const batch=await Promise.all(rows.slice(i,i+5).map(async(x:any)=>{try{return toMovie(await allowed({type,id:x.id,season:undefined,episode:undefined},true),type,true);}catch{return null;}}));items.push(...batch.filter((x):x is CatalogItem=>!!x));}}else items=rows.map((x:any)=>toMovie(x,type));
 return {items,hasMore:page<Math.min(d.total_pages||1,500)};
}
const released=(e:any)=>e.air_date&&e.air_date<=new Date().toISOString().slice(0,10);
function publicError(e:any){const m=String(e?.message||'Source unavailable');return m.replace(/DramaTip/ig,'Shorts').replace(/https?:\/\/[^\s]+/g,'[source]').replace(/<[^>]*>/g,'').slice(0,350);}
export function registerWebSources(app:Express){
 registerDramaMedia(app);registerShortsCompatibility(app);
 app.get('/api/web-sources/status',(_req,res)=>res.json({success:true,configured:!!process.env.TMDB_API_KEY,servers:EMBED_SERVERS.map(p=>({id:p.id,name:p.name})),animation:'TMDB genre 16',tv:false,offlineDownloads:false}));
 app.get(['/api/web-sources/catalog','/api/web-sources/anime'],async(req,res)=>{try{
 const p=profile(req),page=number(req.query.page),q=String(req.query.q||'').slice(0,150),animation=req.path.endsWith('/anime')||req.query.type==='animation';
 const types:('movie'|'tv')[]=animation||req.query.type==='search'?['movie','tv']:[req.query.type==='tv'?'tv':'movie'];
 const parts=await Promise.all(types.map(type=>catalog(type,page,q,p.isKid,animation)));res.json({success:true,page,items:parts.flatMap(d=>d.items),hasMore:parts.some(d=>d.hasMore)});
 }catch(e:any){res.status(502).json({success:false,error:publicError(e)});}});
 app.get('/api/web-sources/hero/netflix',async(req,res)=>{try{const p=profile(req);const d=await tmdb('discover/tv',{with_networks:'213',first_air_date_year:'2026',include_adult:'false',sort_by:'popularity.desc'});const candidates=await Promise.all((d.results||[]).slice(0,12).map(async(x:any)=>{try{const detail=await allowed({type:'tv',id:x.id,season:undefined,episode:undefined},p.isKid);const videos=(detail.videos?.results||[]).filter((v:any)=>v.site==='YouTube'&&v.type==='Trailer'&&v.official&&v.size>=480).sort((a:any,b:any)=>b.size-a.size);return videos.length?{...toMovie(detail,'tv',p.isKid),trailerId:videos[0].key}:null;}catch{return null;}}));const rows=candidates.filter(Boolean).slice(0,6);res.json({success:true,items:rows});}catch(e:any){res.status(502).json({success:false,error:publicError(e)});}});
 app.get('/api/web-sources/home/:shelf',async(req,res)=>{try{
 const p=profile(req),shelf=req.params.shelf,types:Record<string,'movie'|'tv'>={top10:'movie',asian:'movie',horror:'movie',romance:'movie',action:'movie',comedy:'movie',scifi:'movie',crime:'tv',korean:'tv',family:'movie',documentary:'movie'};
 if(!types[shelf])return res.status(400).json({success:false,error:'Unknown collection'});
 const d=await catalog(types[shelf],1,'',p.isKid,false,shelf);res.json({success:true,items:d.items.slice(0,shelf==='top10'?10:16)});
 }catch(e:any){res.status(502).json({success:false,error:publicError(e)});}});
 app.get('/api/web-sources/clips',async(req,res)=>{try{const p=profile(req);if(p.isKid)return res.json({success:true,items:[],hasMore:false,note:'Shorts are unavailable in Kids profiles.'});const d=await dramaCatalog(number(req.query.page),String(req.query.category||'popular'),String(req.query.q||'').slice(0,150),req.query.lang==='ar'?'ar':'en');res.json({success:true,...d});}catch(e:any){res.status(502).json({success:false,error:publicError(e)});}});
 app.get('/api/shorts/subtitles',async(req,res)=>{try{
 const p=profile(req);if(p.isKid)throw new Error('Shorts are unavailable in Kids profiles.');
 const id=String(req.query.contentId||''),identity=parseDramaIdentity(id);if(!identity.episode)throw new Error('Select an episode');
 const details=await dramaDetails(identity.seriesId);if(!details.episodes.some(e=>e.id===id))throw new Error('Episode unavailable');
 const result=await discoverDramaEpisodeSubtitles(id);res.json({success:true,complete:result.complete,subtitles:result.tracks.map(sub=>({...sub,url:subtitleLease(sub.url)}))});
 }catch(e:any){res.status(502).json({success:false,error:publicError(e)});}});
 app.get('/api/people/:id/credits',async(req,res)=>{try{
 const p=profile(req),personId=number(req.params.id,1,2147483647),exclude=String(req.query.exclude||'');
 if(exclude)webId(exclude);
 const data=await tmdb(`person/${personId}/combined_credits`),seen=new Set<string>();
 const rows=(Array.isArray(data.cast)?data.cast:[]).filter((x:any)=>(x.media_type==='movie'||x.media_type==='tv')&&!x.adult&&Number.isSafeInteger(x.id)&&x.id>0&&(x.title||x.name)&&!(/^(self|himself|herself|themself|themselves)(\b|\s|$)/i.test(String(x.character||'').trim()))&&!(x.media_type==='tv'&&(x.genre_ids||[]).some((g:number)=>[10763,10764,10767].includes(g))))
 .sort((a:any,b:any)=>(Number(b.popularity)||0)-(Number(a.popularity)||0)).filter((x:any)=>{const k=`w32:${x.media_type}:${x.id}`;if(seen.has(k)||exclude===k||exclude.startsWith(k+':'))return false;seen.add(k);return true}).slice(0,p.isKid?20:48);
 let items:CatalogItem[]=[];if(p.isKid){for(let i=0;i<rows.length;i+=5){const batch=await Promise.all(rows.slice(i,i+5).map(async(x:any)=>{try{return toMovie(await allowed({type:x.media_type,id:x.id,season:undefined,episode:undefined},true),x.media_type,true)}catch{return null}}));items.push(...batch.filter((x:CatalogItem|null):x is CatalogItem=>!!x))}}else items=rows.map((x:any)=>toMovie(x,x.media_type));
 res.json({success:true,items});
 }catch(e:any){res.status(502).json({success:false,error:publicError(e)});}});
 app.get('/api/media/:id/artwork',async(req,res,next)=>{
 if(!/^(w32:|ani:|drama:|short:)/.test(req.params.id))return next();try{const p=profile(req);
 if(req.params.id.startsWith('short:'))throw new Error('Find this title again in Shorts.');
 if(req.params.id.startsWith('drama:')){if(p.isKid)throw new Error('No verified Kids rating');const d=await dramaDetails(req.params.id);return res.json({success:true,posterUrl:d.item.logoUrl,backdropUrl:d.item.backdropUrl,overview:d.item.overview,item:d.item,episodes:d.episodes,seasons:[1],season:1});}
 const id=webId(req.params.id),d=await allowed(id,p.isKid),v=d.videos?.results?.find((x:any)=>x.site==='YouTube'&&x.type==='Trailer'&&x.official)||d.videos?.results?.find((x:any)=>x.site==='YouTube'&&x.type==='Trailer');
 res.json({success:true,posterUrl:img(d.poster_path),backdropUrl:img(d.backdrop_path,'w1280'),overview:d.overview,trailerId:v?.key,trailers:d.videos?.results?.filter((x:any)=>x.site==='YouTube'&&['Trailer','Teaser'].includes(x.type)&&/^[A-Za-z0-9_-]{6,20}$/.test(x.key)).slice(0,8).map((x:any)=>({id:x.key,name:x.name||x.type})),genres:d.genres?.map((g:any)=>g.name),year:(d.release_date||d.first_air_date||'').slice(0,4),rating:Number(d.vote_average||0).toFixed(1),cast:(d.credits?.cast||[]).slice(0,12).map((c:any)=>({id:c.id,name:c.name,character:c.character,photo:img(c.profile_path,'w185')})),similar:p.isKid?[]:(d.recommendations?.results||[]).filter((x:any)=>!x.adult).slice(0,12).map((x:any)=>toMovie(x,id.type))});
 }catch(e:any){res.status(502).json({success:false,error:publicError(e)});}});
 app.get('/api/series/:id/episodes',async(req,res,next)=>{
 if(!/^(w32:|ani:|drama:|short:)/.test(req.params.id))return next();try{const p=profile(req);
 if(req.params.id.startsWith('short:'))throw new Error('Find this title again in Shorts.');
 if(req.params.id.startsWith('drama:')){if(p.isKid)throw new Error('No verified Kids rating');const d=await dramaDetails(req.params.id);return res.json({success:true,posterUrl:d.item.logoUrl,backdropUrl:d.item.backdropUrl,overview:d.item.overview,item:d.item,episodes:d.episodes,seasons:[1],season:1});}
 const id=webId(req.params.id);if(id.type!=='tv')throw new Error('Not a series');const d=await allowed(id,p.isKid),seasons=(d.seasons||[]).filter((s:any)=>s.season_number>0).map((s:any)=>s.season_number);const season=number(req.query.season,seasons[0]||1);if(!seasons.includes(season))return res.json({success:true,seasons,episodes:[],season});
 const part=await tmdb(`tv/${id.id}/season/${season}`);const episodes=(part.episodes||[]).filter(released).map((e:any)=>({...toMovie(d,'tv',p.isKid),id:`w32:tv:${id.id}:${season}:${e.episode_number}`,name:e.name,season,episode:e.episode_number,backdropUrl:img(e.still_path,'w780'),overview:e.overview}));res.json({success:true,episodes,seasons,season});
 }catch(e:any){res.status(502).json({success:false,error:publicError(e)});}});
 app.post('/api/shorts/prepare',async(req,res)=>{try{const p=profile(req);if(p.isKid)return res.sendStatus(403);const id=String(req.body.contentId||''),identity=parseDramaIdentity(id),details=await dramaDetails(identity.seriesId);if(!details.episodes.some(e=>e.id===id))return res.sendStatus(404);await prepareShort(id,req.socket.localPort!,true);res.json({success:true});}catch{res.status(502).json({success:false,error:'Episode preparation unavailable'});}});
 app.post('/api/stream/token',async(req,res,next)=>{
 if(!/^(w32:|ani:|drama:|short:)/.test(String(req.body.contentId)))return next();try{const p=profile(req);const variantId=String(req.body.variantId||'cinesrc');
 if(String(req.body.contentId).startsWith('short:'))throw new Error('Find this title again in Shorts.');
 if(String(req.body.contentId).startsWith('drama:')){if(p.isKid)throw new Error('No verified Kids rating');const id=String(req.body.contentId),identity=parseDramaIdentity(id),d=await dramaDetails(identity.seriesId);const ep=d.episodes.find(e=>e.id===id);if(!ep)throw new Error('Select an available episode');const prepared=await prepareShort(id,req.socket.localPort!);if(!prepared)throw Error('Episode preparation unavailable');const {source,local}=prepared;let lease=prepared.lease;const compatible=req.body.compatibility===true||prepared.compatible;if(compatible)lease=compatibilityLease(local);return res.json({success:true,token:randomUUID(),streamUrl:lease,streamType:compatible?'hls':source.streamType,subtitles:source.subtitles.map(sub=>({...sub,url:subtitleLease(sub.url)})),variantId:'shorts',variants:[{id:'shorts',label:'Shorts'}],content:ep});}
 const directOptions = req.body.directVod === true ? directVodOptions() : [];
 const provider = directOptions.find(source => source.id === variantId);
 const embedOptions = EMBED_SERVERS.filter(source => ['vidstuck','videasy','vidlink','cinesrc'].includes(source.id));
 const embed = embedOptions.some(source => source.id === variantId);
 if (!provider && !embed) throw new Error('Unknown player source');
 const id = webId(req.body.contentId), d = await allowed(id,p.isKid);
 if (id.type === 'tv') {
   if (!id.season || !id.episode) throw new Error('Select an episode first');
   const part = await tmdb(`tv/${id.id}/season/${id.season}`);
   if (!(part.episodes || []).some((e:any) => e.episode_number === id.episode && released(e))) {
     throw new Error('Episode is not released or available');
   }
 }
 const content = {...toMovie(d,id.type,p.isKid),id:req.body.contentId,season:id.season,episode:id.episode};
 const variants = [
   ...embedOptions.map(source => ({id:source.id,label:source.name})),
   ...directOptions.map(({id,label}) => ({id,label})),
 ];
 if (provider) {
   const stream = await resolveDirectVod(provider, {
     ...id, name: content.name, originalName: d.original_title || d.original_name,
     year: (d.release_date || d.first_air_date || '').slice(0,4),
   });
   if (!stream) throw new Error(`${provider.label} has no playable source for this title. Try another source.`);
   return res.set('Cache-Control','no-store').json({
     success:true, token:randomUUID(), ...stream, variantId, variants, content,
   });
 }
 const url = embedUrl(variantId,id.type,id.id,id.season,id.episode);
 res.json({success:true,token:'',streamUrl:'',streamType:'hls',embedUrl:url,variantId,variants,content});
 }catch(e:any){res.status(502).json({success:false,error:publicError(e)});}});
}
