import catalogue from './previewCatalogue.json';
const profile={id:'preview',name:'Preview',avatar:'disney_01',isKid:false,isLocked:false};
export function previewEnabled(){return import.meta.env.PROD&&!import.meta.env.VITE_NETSHOW_API_BASE&&location.hostname.endsWith('.vercel.app');}
export async function previewFetch(path:string,init?:RequestInit):Promise<Response>{
 const url=new URL(path,location.origin);let data:any={success:true,items:[],hasMore:false,episodes:[],seasons:[],history:[],favorites:[]};let status=200;
 const all=[...catalogue.movie,...catalogue.tv];
 if(path.startsWith('/api/profiles'))data={...data,profiles:[profile],profile};
 else if(path.includes('/hero/netflix'))data={...data,items:catalogue.tv.slice(0,6)};
 else if(path.includes('/home/'))data={...data,items:catalogue.movie.slice(0,10)};
 else if(path.includes('/catalog')||path.includes('/anime')){const q=(url.searchParams.get('q')||'').toLowerCase();const items=url.searchParams.get('type')==='tv'?catalogue.tv:url.searchParams.get('type')==='search'?all:catalogue.movie;data={...data,items:items.filter(i=>i.name.toLowerCase().includes(q))};}
 else if(path.includes('/artwork')){const item=all.find(i=>path.includes(encodeURIComponent(i.id)));data={...data,...item,posterUrl:item?.logoUrl};}
 else if((init?.method||'GET')!=='GET'||/play|resolve/.test(path)){status=503;data={success:false,error:'Interface preview: connect the backend to enable playback and account changes.'};}
 return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
}
