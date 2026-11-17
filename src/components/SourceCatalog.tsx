import {useEffect,useRef,useState} from 'react';
import {Search,X} from 'lucide-react';
import {isXtreamPreview} from '../player/vodPreview';
import {catalogJson} from '../player/catalogCache';
import {useProfile} from '../context/ProfileContext';
import {useCatalog} from '../context/CatalogContext';
import {MediaTile} from './MediaTile';
import {HeroBanner} from './HeroBanner';
import type {CatalogItem} from '../types';

type SourceType = 'movie' | 'tv' | 'animation' | 'search' | 'clips';

export function SourceCatalog({type}:{type:SourceType}) {
  const {activeProfile} = useProfile();
  const {searchQuery,activeTab} = useCatalog();
  return <SourcePage key={`${type}:${activeProfile?.id}:${activeProfile?.isKid}:${activeTab==='search'?searchQuery:''}`} type={type}/>;
}

function SourcePage({type}:{type:SourceType}) {
  const {activeProfile} = useProfile();
  const {searchQuery,activeTab,rememberSourceItems} = useCatalog();
  const freeReels = type === 'clips' && isXtreamPreview();
  const languageKey = freeReels ? 'moroshow-freereels-language' : 'moroshow-shorts-catalog';
  const [localQuery,setLocalQuery] = useState('');
  const [category,setCategory] = useState('popular');
  const [storyLanguage,setStoryLanguage] = useState(() => {
    try { return localStorage.getItem(languageKey) === 'ar' ? 'ar' : 'en'; }
    catch { return 'en'; }
  });
  const query = activeTab === 'search' ? searchQuery : localQuery;
  const arabic = freeReels && storyLanguage === 'ar';

  return <section
    className={`m-source${type==='clips'?' ms-shorts-catalog':''}${freeReels?' ms-freereels-catalog':''}`}
    aria-label={type==='clips'?(arabic?'المسلسلات القصيرة':'Shorts'):type==='animation'?'Anime':type}
    dir={freeReels ? (arabic?'rtl':'ltr') : undefined}
    lang={freeReels?storyLanguage:undefined}>
    {type==='clips'&&activeTab!=='search'&&<>
      <div className="ms-browse-tools">
        <form className="ms-search" onSubmit={event=>event.preventDefault()}>
          <Search size={19}/>
          <input aria-label={arabic?'ابحث عن مسلسل قصير':'Search short dramas'}
            placeholder={arabic?'ابحث عن مسلسل قصير…':'Search short dramas…'}
            value={localQuery} onChange={event=>setLocalQuery(event.target.value)} dir="auto"/>
          {localQuery&&<button aria-label={arabic?'مسح البحث':'Clear search'} type="button"
            onClick={()=>setLocalQuery('')}><X size={17}/></button>}
        </form>
        <label className="ms-language-compact">
          <span className="sr-only">{arabic?'لغة المسلسلات':'Story language'}</span>
          <select aria-label={arabic?'لغة المسلسلات':'Shorts catalogue language'} value={storyLanguage}
            onChange={event=>{
              const value=event.target.value;
              setStoryLanguage(value);
              try { localStorage.setItem(languageKey,value); } catch {}
            }}>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </label>
      </div>
      {!freeReels&&<div className="m-filters ms-category-tabs">
        {[['popular','For you'],['new-releases','New'],['romance','Romance'],['revenge','Revenge']].map(([id,label])=>
          <button key={id} className={category===id?'selected':''} onClick={()=>setCategory(id)}>{label}</button>)}
      </div>}
    </>}
    <CatalogResults key={`${type}:${category}:${query}:${storyLanguage}`} freeReels={freeReels}
      storyLanguage={storyLanguage} type={type} category={category} query={query}
      remember={rememberSourceItems} profileId={activeProfile?.id} kid={!!activeProfile?.isKid}/>
  </section>;
}

type ResultsProps = {
  freeReels: boolean; storyLanguage: string; type: SourceType; category: string; query: string;
  remember: (items: CatalogItem[]) => void; profileId?: string; kid: boolean;
};

function CatalogResults({type,category,query,remember,profileId,kid,storyLanguage,freeReels}:ResultsProps) {
  const [items,setItems] = useState<CatalogItem[]>([]);
  const [page,setPage] = useState(1);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [cursor,setCursor] = useState('');
  const [nextCursor,setNextCursor] = useState('');
  const [more,setMore] = useState(false);
  const [note,setNote] = useState('');
  const [retry,setRetry] = useState(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const arabic = freeReels && storyLanguage === 'ar';

  useEffect(()=>{
    if(!profileId)return;
    let cancelled=false;
    setLoading(true);
    setError('');
    const timer=setTimeout(async()=>{
      try{
        const params = new URLSearchParams({profileId,type,page:String(page),q:query,category,lang:storyLanguage,kids:kid?'1':'0'});
        if(freeReels&&cursor)params.set('cursor',cursor);
        if(retry)params.set('retry',String(retry));
        const endpoint = freeReels ? '/api/shorts-router/catalog' : `/api/web-sources/${type==='clips'?'clips':'catalog'}`;
        const data = await catalogJson(`${endpoint}?${params}`,!kid);
        if(cancelled)return;
        remember(data.items);
        setItems(old=>[...new Map([...(page===1?[]:old),...data.items].map((item:CatalogItem)=>[item.id,item])).values()] as CatalogItem[]);
        setNextCursor(data.nextCursor||'');
        setMore(data.hasMore&&(!freeReels||!!data.nextCursor&&data.nextCursor!==cursor));
        setNote(data.note||'');
      }catch(cause){
        if(!cancelled)setError(cause instanceof Error ? cause.message : (arabic?'تعذّر تحميل المسلسلات.':'Could not load titles.'));
      }finally{
        if(!cancelled)setLoading(false);
      }
    },query?350:0);
    return()=>{cancelled=true;clearTimeout(timer);};
  },[page,retry,profileId,cursor]);

  useEffect(()=>{
    if(!freeReels||!more||loading||error||!sentinel.current)return;
    const observer=new IntersectionObserver(([entry])=>{
      if(!entry.isIntersecting)return;
      observer.disconnect();
      setCursor(nextCursor);
      setPage(current=>current+1);
    },{rootMargin:'250px 0px'});
    observer.observe(sentinel.current);
    return()=>observer.disconnect();
  },[freeReels,more,loading,error,nextCursor]);

  return <>
    {type==='clips'&&!query&&items.length>0&&<HeroBanner entries={items} clips arabic={arabic}/>}
    {type==='clips'&&!query&&items.length>0&&<h2 className="ms-catalog-heading" dir="auto">
      {arabic?'اكتشف المسلسلات':category==='new-releases'?'New stories':'Discover stories'}
    </h2>}
    {note&&<p className="m-notice">{note}</p>}
    {error&&<div role="alert" className="m-notice"><p>{error}</p>
      <button className="m-secondary" onClick={()=>setRetry(current=>current+1)}>{arabic?'حاول مرة أخرى':'Try again'}</button>
    </div>}
    <div className="m-grid">{items.map(item=><MediaTile key={item.id} item={item}/>)}</div>
    {loading&&<div role="status" className="m-loading">{arabic?'جارٍ تحميل المسلسلات…':type==='clips'?'Loading stories…':'Loading titles…'}</div>}
    {!loading&&!error&&!note&&!items.length&&<p className="m-empty">
      {arabic?'ما كايناش نتائج. جرّب عنوان آخر.':type==='clips'?'No results. Try another search.':'No titles found. Try another search.'}
    </p>}
    {freeReels ? <div ref={sentinel} aria-hidden="true"/> :
      !loading&&more&&!error&&<button className="m-load-more m-secondary" onClick={()=>setPage(current=>current+1)}>Load more</button>}
  </>;
}
