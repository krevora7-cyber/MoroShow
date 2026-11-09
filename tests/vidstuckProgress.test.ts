import test from 'node:test';
import assert from 'node:assert/strict';
import {readVidstuckProgress} from '../src/player/vidstuckProgress';
const good={type:'VIDEO_PROGRESS',payload:{currentTime:31.5,duration:2603.5,tmdbId:'94605',media_type:'tv',season:1,episode:1}};
test('accepts real provider event only for exact origin and episode',()=>{
 assert.deepEqual(readVidstuckProgress('https://vidstuck.cc',good,'w32:tv:94605:1:1'),{time:31.5,duration:2603.5,event:'timeupdate'});
 assert.equal(readVidstuckProgress('https://vidstuck.cc',JSON.stringify(good),'w32:tv:94605:1:1')?.time,31.5);
 for(const [origin,id] of [['https://vidstuck.cc.evil.test','w32:tv:94605:1:1'],['https://vidstuck.cc','w32:tv:94605:1:2'],['https://vidstuck.cc','w32:movie:94605'],['https://vidstuck.cc','w32:tv:94605']] as const)assert.equal(readVidstuckProgress(origin,good,id),null);
});
test('rejects bad or forged values',()=>{
 for(const t of [-1,Infinity,3000,'oops'])assert.equal(readVidstuckProgress('https://vidstuck.cc',{...good,payload:{...good.payload,currentTime:t}},'w32:tv:94605:1:1'),null);
 assert.equal(readVidstuckProgress('https://vidstuck.cc',{...good,type:'PLAYING'},'w32:tv:94605:1:1'),null);
 assert.equal(readVidstuckProgress('https://vidstuck.cc','not json','w32:tv:94605:1:1'),null);
});
