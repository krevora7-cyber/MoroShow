import test from 'node:test';
import assert from 'node:assert/strict';
import {browserPlayback,movieEmbedPlayback,POPUP_SANDBOX} from '../src/player/browserPlayback';
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
test('protected mode keeps selected provider and episode while blocking popups',()=>{
 for(const raw of ['https://cinesrc.st/embed/tv/1396?s=2&e=3','https://vidlink.pro/tv/1396/2/3?startAt=90','https://player.cinezo.live/embed/movie/101']){
 const config=browserPlayback(raw,'protected');assert.equal(config.url,raw);assert.equal(config.sandbox,POPUP_SANDBOX);assert.doesNotMatch(config.sandbox,/allow-popups|allow-top-navigation/);
 }
 for(const raw of ['https://evil.example/embed/movie/101','https://user@vidlink.pro/movie/101'])assert.throws(()=>browserPlayback(raw,'protected'));
});

test('movie embed compatibility is restricted to the selected backup origins',()=>{
 assert.equal(movieEmbedPlayback('https://cinesrc.st/embed/movie/101').sandbox,POPUP_SANDBOX);
 for(const url of ['https://vidstuck.cc/embed/movie/101','https://player.videasy.ws/embed/movie/101','https://vidlink.pro/movie/101']){
  const result=movieEmbedPlayback(url);
  assert.equal(result.url,url);
  assert.equal(result.sandbox,undefined);
 }
 assert.throws(()=>movieEmbedPlayback('https://evil.example/embed/movie/101'));
 assert.throws(()=>movieEmbedPlayback('https://user@vidlink.pro/movie/101'));
});
