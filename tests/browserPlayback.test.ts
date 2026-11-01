import test from 'node:test';
import assert from 'node:assert/strict';
import {browserPlayback,POPUP_SANDBOX} from '../src/player/browserPlayback';
test('standard preserves existing sources and parameters',()=>{
 for(const raw of ['https://player.cinezo.live/embed/movie/101','https://vidlink.pro/tv/1396/2/3?startAt=90','https://vidsrc.mov/embed/movie/101','https://vidsrc.sh/embed/movie/101','https://dramatip.net/embed/abc']){
  const result=browserPlayback(raw,'standard');assert.equal(result.url,raw);assert.equal(result.sandbox,undefined);
 }
});
test('compatibility is reversible and JW option stays within VidLink',()=>{
 const raw='https://vidlink.pro/movie/101?startAt=90';
 assert.equal(new URL(browserPlayback(raw,'compatibility').url).searchParams.get('player'),'jw');
 assert.equal(browserPlayback(raw,'standard').url,raw);
 assert.equal(browserPlayback('https://player.cinezo.live/embed/movie/101','compatibility').url,'https://player.cinezo.live/embed/movie/101');
});
test('protected fallback keeps exact movie/episode identity and denies popup/navigation permissions',()=>{
 const config=browserPlayback('https://vidlink.pro/tv/1396/2/3?startAt=90','protected');const url=new URL(config.url);
 assert.equal(url.pathname,'/embed/tv/1396');assert.equal(url.searchParams.get('s'),'2');assert.equal(url.searchParams.get('e'),'3');assert.equal(url.searchParams.get('t'),'90');
 assert.equal(config.sandbox,POPUP_SANDBOX);assert.doesNotMatch(config.sandbox,/allow-popups|allow-top-navigation/);
 assert.equal(new URL(browserPlayback('https://player.cinezo.live/embed/movie/101','protected').url).pathname,'/embed/movie/101');
 for(const raw of ['https://evil.example/embed/movie/101','https://user@vidlink.pro/movie/101','https://dramatip.net/embed/101','https://vidlink.pro/tv/1396','https://vidlink.pro/movie/101/2/3/4'])assert.throws(()=>browserPlayback(raw,'protected'));
});
