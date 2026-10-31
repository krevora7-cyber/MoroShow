import 'dotenv/config';
import { loadGateway, resolveGatewayStream, loadGatewayEpisodes, registerGatewayItems } from '../src/server/addonGateway.ts';
import { fnv1a64 } from '../src/utils/fnv1a64.ts';
import { consolidationKey } from '../src/utils/groupCatalog.ts';
console.log('NetShow v4 gateway diagnostic (URLs and provider secrets not printed).');
const response=await loadGateway();
for(const status of response.status){
 console.log(`${status.source.padEnd(13)} ${status.status.padEnd(15)} ${status.items} items / ${status.catalogs} catalogs`);
 if(status.error)console.log('  Error: '+status.error);
}
console.log('Catalog entries:',response.items.length);
if(response.items.length){
 const byKind=['movie','series','live'];
 for(const kind of byKind){
  const media=response.items.find(x=>x.item.kind===kind);
  if(!media){console.log(kind+': no entries');continue;}
  const id=`ns-g-${fnv1a64(consolidationKey(media.item))}`;
  try{
   if(kind==='series'){
    const list=await loadGatewayEpisodes(id);registerGatewayItems(list,false);
    console.log('series: '+list.length+' episodes; '+(list.length?'available':'no episode metadata'));
   }else{
    const stream=await resolveGatewayStream(id);
    // Do not output media URL or any provider credentials.
    console.log(kind+': stream resolved as '+stream.kind+' (video decoding still requires browser test)');
   }
  }catch(error){console.log(kind+': '+(error?.message||error).slice(0,200));}
 }
}
if(!response.items.length)process.exitCode=2;
