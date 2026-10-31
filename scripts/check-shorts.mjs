import {shortCatalog,shortDetails,shortStream} from '../src/server/shortProviders.ts';
const results=[];
for(const provider of ['dramabox','goodshort','reelshort']){
 const row={provider,catalog:false,episodes:false,streamResolved:false};
 try{const d=await shortCatalog(provider,1,'');row.count=d.items.length;row.catalog=true;if(d.items.length){const detail=await shortDetails(d.items[0].id);row.episodeCount=detail.episodes.length;row.episodes=true;if(detail.episodes.length){const stream=await shortStream(detail.episodes[0].id);row.streamResolved=!!stream.url;row.kind=stream.kind;}}}catch(e){row.error=e.message;}
 results.push(row);
}
console.log(JSON.stringify({checkedAt:new Date().toISOString(),results,browserPlaybackVerified:false},null,2));process.exit(0);
