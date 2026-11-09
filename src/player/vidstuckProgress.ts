/** Validate progress from Vidstuck before associating it with the active item. */
export function readVidstuckProgress(origin:string,data:unknown,contentId:string){
 if(origin!=='https://vidstuck.cc') return null;
 if(typeof data==='string'){try{data=JSON.parse(data)}catch{return null}}
 if(!data || typeof data!=='object')return null;
 const msg=data as {type?:unknown,payload?:unknown};
 if(msg.type!=='VIDEO_PROGRESS'||!msg.payload||typeof msg.payload!=='object')return null;
 const d=msg.payload as Record<string,unknown>,m=/^w32:(movie|tv):(\d+)(?::(\d+):(\d+))?$/.exec(contentId);
 if(!m||String(d.tmdbId)!==m[2]||d.media_type!==m[1])return null;
 if(m[1]==='tv'&&(!m[3]||!m[4]||Number(d.season)!==Number(m[3])||Number(d.episode)!==Number(m[4])))return null;
 const time=Number(d.currentTime),duration=Number(d.duration);
 if(!Number.isFinite(time)||!Number.isFinite(duration)||time<0||duration<=0||time>duration+5||duration>86400)return null;
 return {time:Math.min(time,duration),duration,event:'timeupdate'};
}
