import {createHash} from 'node:crypto';
export const PUBLIC_LISTS=[
 {id:'iptv-org',name:'IPTV-org',url:'https://iptv-org.github.io/iptv/index.m3u',website:'https://github.com/iptv-org/iptv'},
 {id:'nexus',name:'IPTV Nexus',url:'https://dearbulut.github.io/iptv/playlists/index.m3u',website:'https://github.com/dearbulut/iptv'},
 {id:'free-public',name:'Free Public IPTV',url:'https://raw.githubusercontent.com/freecasthub/public-iptv/main/playlist.m3u',website:'https://github.com/freecasthub/public-iptv'},
 {id:'doubo',name:'Doubo',url:'https://cdn.jsdelivr.net/gh/streamline-iptv/iptv-playlists@dist/index.m3u',website:'https://github.com/streamline-iptv/iptv-playlists',license:'CC BY 4.0'},
];
export type Feed={id:string;url:string;provider:string};
export type PublicChannel={id:string;tvgId:string;name:string;category:string;country:string;language:string;logoUrl?:string;sources:Feed[]};
const hash=(s:string)=>createHash('sha256').update(s).digest('hex').slice(0,24);
const normal=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
function clean(s:string){return s.replace(/\[(?:geo.blocked|not 24\/7)\]/ig,'').replace(/\b(?:FHD|UHD|HD|SD|HEVC|H264|H265|\d{3,4}p|4K)\b/ig,'').replace(/\(\s*\)/g,'').replace(/\s+/g,' ').trim();}
export function parsePublicM3u(text:string,provider:string):PublicChannel[]{
 if(!text.trimStart().startsWith('#EXTM3U'))throw Error('Not an M3U playlist');
 const out:PublicChannel[]=[];let attrs:Record<string,string>={},name='';
 for(const raw of text.split(/\r?\n/)){
 const line=raw.trim();if(line.startsWith('#EXTINF:')){attrs={};for(const m of line.matchAll(/([\w-]+)="([^"]*)"/g))attrs[m[1]]=m[2];let quoted=false,comma=-1;for(let i=0;i<line.length;i++){if(line[i]==='"')quoted=!quoted;if(line[i]===','&&!quoted){comma=i;break;}}name=comma>=0?line.slice(comma+1):'';continue;}
 if(!line||line.startsWith('#'))continue;if(!name)continue;
 const original=name;name='';let url:URL;try{url=new URL(line);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||! /\.(m3u8|mp4)$/i.test(url.pathname))continue;}catch{continue;}
 const category=(attrs['group-title']||'Other').split(';')[0].trim()||'Other';if(/\b(?:xxx|adult|porn)\b|18\+/i.test(category+' '+original))continue;
 const tvgId=(attrs['tvg-id']||'').replace(/@(?:SD|HD|FHD|UHD|4K|\d{3,4}p)$/i,'');const country=(attrs['tvg-country']||/\.([a-z]{2})(?:@|$)/i.exec(tvgId)?.[1]||'').toUpperCase();
 const edition=tvgId.split('@')[1];let display=clean(original);if(edition&&!normal(display).includes(normal(edition)))display+=' · '+edition;
 const logo=attrs['tvg-logo'];out.push({id:'',tvgId,name:display||original,category,country,language:normal(attrs['tvg-language']||''),logoUrl:logo?.startsWith('https://')?logo:undefined,sources:[{id:hash(url.href),url:url.href,provider}]});
 }return out;
}
export function mergePublicChannels(rows:PublicChannel[]):PublicChannel[]{
 const aliases=new Map<string,Set<string>>();const add=(key:string,id:string)=>{if(!aliases.has(key))aliases.set(key,new Set());aliases.get(key)!.add(id);};
 for(const c of rows)if(c.tvgId){const id=normal(c.tvgId);add('name:'+normal(c.name)+'|'+c.country+'|'+c.language,id);add('loose:'+normal(c.name)+'|'+c.language,id);for(const s of c.sources)add('url:'+s.url,id);}
 const unique=(key:string)=>{const a=aliases.get(key);return a?.size===1?[...a][0]:undefined;};const merged=new Map<string,PublicChannel>();
 for(const c of rows){const identity=normal(c.tvgId)||unique('name:'+normal(c.name)+'|'+c.country+'|'+c.language)||(!c.country?unique('loose:'+normal(c.name)+'|'+c.language):undefined)||(!c.country&&!c.language?unique('url:'+c.sources[0].url):undefined);const key=identity?'id:'+identity:'name:'+normal(c.name)+'|'+c.country+'|'+c.language;
 const old=merged.get(key);if(!old){merged.set(key,{...c,id:'public:'+hash(key),sources:[...c.sources]});continue;}for(const source of c.sources)if(!old.sources.some(s=>s.url===source.url)&&old.sources.length<24)old.sources.push(source);old.logoUrl ||= c.logoUrl;if(old.category==='Other')old.category=c.category;
 }return [...merged.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
