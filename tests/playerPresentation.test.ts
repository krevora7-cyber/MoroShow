import test from 'node:test';
import assert from 'node:assert/strict';
import {captionMode,enterShortsFullscreen,isIOSDevice,activeCaptionText} from '../src/player/shortsPresentation';
import {embedStartUrl,orderEmbedVariants,needsPlayerWindow} from '../src/player/embedPresentation';
test('iPhone and touch iPad use native video fullscreen from the click',async()=>{
 let native=0,container=0;const video={webkitEnterFullscreen:()=>native++} as any,frame={requestFullscreen:async()=>{container++;}} as any;
 assert.equal(await enterShortsFullscreen(video,frame,{} as any,true),'native');assert.equal(native,1);assert.equal(container,0);
 assert.equal(isIOSDevice({userAgent:'iPhone',platform:'iPhone',maxTouchPoints:5}),true);
 assert.equal(isIOSDevice({userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:5}),true);
 assert.equal(isIOSDevice({userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:0}),false);
});
test('desktop enters/exits container fullscreen and reports unsupported/rejected calls',async()=>{
 let calls=0;const f={requestFullscreen:async()=>{calls++;}} as any;
 await enterShortsFullscreen({} as any,f,{} as any,false);assert.equal(calls,1);
 await enterShortsFullscreen({} as any,f,{fullscreenElement:{},exitFullscreen:async()=>{calls++;}} as any,false);assert.equal(calls,2);
 await assert.rejects(enterShortsFullscreen({} as any,{} as any,{} as any,false));
 await assert.rejects(enterShortsFullscreen({} as any,{requestFullscreen:()=>Promise.reject(new Error('Denied'))} as any,{} as any,false));
});
test('Arabic cues stay active for custom overlay and switch to native fullscreen rendering',()=>{
 assert.equal(captionMode(true,'ar-AE',false,'ar-AE'),'hidden');assert.equal(captionMode(true,'ar',true),'showing');assert.equal(captionMode(false,'ar',true),'disabled');assert.equal(captionMode(true,'en',false),'disabled');
 const tracks=[{language:'ar-AE',mode:'hidden',activeCues:[{getCueAsHTML:()=>({textContent:'مرحبا بالعالم'})}]},{language:'en',mode:'showing',activeCues:[{text:'ignore'}]}] as any;
 assert.equal(activeCaptionText(tracks,'ar-AE'),'مرحبا بالعالم');tracks[0].mode='disabled';assert.equal(activeCaptionText(tracks,'ar-AE'),'');
});
test('embed resume and iPhone alternatives retain selected media identity',()=>{
 assert.equal(embedStartUrl('https://vidlink.pro/tv/42/2/3',120.5),'https://vidlink.pro/tv/42/2/3?startAt=120');
 assert.equal(embedStartUrl('https://player.cinezo.live/embed/movie/42',120),'https://player.cinezo.live/embed/movie/42');
 assert.equal(embedStartUrl('https://vidstuck.cc/embed/tv/42/2/3',120.5),'https://vidstuck.cc/embed/tv/42/2/3?progress=120');
 const variants=[{id:'cinezo'},{id:'vidsrc-mov'},{id:'vidlink'},{id:'vidsrc-sh'}];assert.equal(orderEmbedVariants(variants,true)[0].id,'vidlink');assert.equal(variants[0].id,'cinezo');
 assert.equal(needsPlayerWindow('https://player.cinezo.live/embed/movie/42',true),false);assert.equal(needsPlayerWindow('https://player.cinezo.live/embed/movie/42',false),false);assert.equal(needsPlayerWindow('https://vidlink.pro/movie/42',true),false);assert.equal(needsPlayerWindow('https://vidsrc.sh/embed/movie/42',true),false);
});
