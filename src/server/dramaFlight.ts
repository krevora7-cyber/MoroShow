// Parse only serialized data records. Never evaluate the site's JavaScript.
export function dramaFlightRecords(html:string){
 let flight='';for(const m of html.matchAll(/self\.__next_f\.push\(\s*\[\s*1\s*,\s*("(?:\\.|[^"\\])*")\s*\]\s*\)/g))try{flight+=JSON.parse(m[1]);}catch{}
 const bytes=Buffer.from(flight),records=new Map<string,unknown>();let offset=0;
 while(offset<bytes.length){
  if(bytes[offset]===10||bytes[offset]===13){offset++;continue;}
  const colon=bytes.indexOf(58,offset);if(colon<0||colon-offset>12)break;
  const id=bytes.subarray(offset,colon).toString();if(!/^[a-f0-9]+$/i.test(id))break;offset=colon+1;
  if(bytes[offset]===84){const comma=bytes.indexOf(44,offset);if(comma<0||comma-offset>10)break;const hex=bytes.subarray(offset+1,comma).toString();if(!/^[a-f0-9]+$/i.test(hex))break;const length=parseInt(hex,16);if(length>5_000_000||comma+1+length>bytes.length)break;records.set(id,bytes.subarray(comma+1,comma+1+length).toString('utf8'));offset=comma+1+length;continue;}
  let end=bytes.indexOf(10,offset);if(end<0)end=bytes.length;try{records.set(id,JSON.parse(bytes.subarray(offset,end).toString()));}catch{}offset=end+1;
 }
 return records;
}
export function resolveDramaFlight(value:unknown,records:Map<string,unknown>,depth=0,seen=new Set<string>()):any{
 if(depth>55)return undefined;
 if(typeof value==='string'){
  const ref=/^\$([a-f0-9]+)(?::(.+))?$/i.exec(value);if(!ref||!records.has(ref[1])||seen.has(value))return value;
  let target:any=records.get(ref[1]);for(const part of ref[2]?.split(':')||[]){if(!target||typeof target!=='object'||['__proto__','prototype','constructor'].includes(part)||!Object.hasOwn(target,part))return undefined;target=target[part];}
  return resolveDramaFlight(target,records,depth+1,new Set([...seen,value]));
 }
 if(Array.isArray(value))return value.map(v=>resolveDramaFlight(v,records,depth+1,seen));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!['__proto__','prototype','constructor'].includes(k)).map(([k,v])=>[k,resolveDramaFlight(v,records,depth+1,seen)]));
 return value;
}
