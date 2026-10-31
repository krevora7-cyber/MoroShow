export function readEmbedProgress(origin:string,data:any,expectedOrigin:string,contentId:string){
 if(origin!==expectedOrigin||!['https://vidlink.pro','https://player.cinezo.live'].includes(origin))return null;
 if(typeof data==='string'){try{data=JSON.parse(data);}catch{return null;}}
 if(data?.type!=='PLAYER_EVENT')return null;
 const d=data.data,m=/^w32:(movie|tv):(\d+)(?::(\d+):(\d+))?$/.exec(contentId);
 if(!m||!d||Number(d.tmdbId??d.mtmdbId)!==Number(m[2])||d.mediaType!==m[1])return null;
 if(m[1]==='tv'&&(Number(d.season)!==Number(m[3])||Number(d.episode)!==Number(m[4])))return null;
 const time=Number(d.currentTime),duration=Number(d.duration);
 if(!Number.isFinite(time)||!Number.isFinite(duration)||time<0||duration<=0||time>duration+5||duration>86400)return null;
 return {time:Math.min(time,duration),duration,event:String(d.event||'timeupdate')};
}
