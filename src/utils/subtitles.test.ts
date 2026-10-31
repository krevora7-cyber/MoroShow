import test from 'node:test';
import assert from 'node:assert/strict';
import {subtitleToVtt} from './subtitles';
test('SRT captions become browser-readable VTT, preserving Arabic and cue timing',()=>{
 const out=subtitleToVtt('\uFEFF1\r\n00:00:01,200 --> 00:00:03,400\r\nمرحبا\r\n');
 assert.ok(out.startsWith('WEBVTT\n\n'));assert.ok(out.includes('00:00:01.200 --> 00:00:03.400'));assert.ok(out.includes('مرحبا'));
});
test('VTT is preserved and provider HTML errors are never presented as captions',()=>{
 assert.equal(subtitleToVtt('WEBVTT\n\n'),'WEBVTT\n\n');
 assert.throws(()=>subtitleToVtt('<html>Access denied</html>'));
});
