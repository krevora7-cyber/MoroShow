import test from 'node:test';import assert from 'node:assert/strict';
import {parsePublicM3u,mergePublicChannels} from '../src/server/publicTvCatalog';
const playlist=(rows:string[])=>'#EXTM3U\n'+rows.join('\n');
const row=(id:string,name:string,url:string,extra='')=>`#EXTINF:-1 tvg-id="${id}" group-title="News" ${extra},${name}\n${url}`;
test('merge quality renditions and duplicate URLs, preserve editions and channel numbers',()=>{
 const a=parsePublicM3u(playlist([row('BBC.uk@HD','BBC HD','https://tv.example/a.m3u8'),row('BBC.uk@SD','BBC SD','https://tv.example/b.m3u8'),row('BBC.uk@Asia','BBC HD','https://tv.example/c.m3u8'),row('BBC2.uk','BBC 2','https://tv.example/d.m3u8')]),'one');const b=parsePublicM3u(playlist([row('BBC.uk','BBC','https://tv.example/a.m3u8')]),'two');const result=mergePublicChannels([...a,...b]);assert.equal(result.length,3);assert.equal(result.find(c=>c.tvgId==='BBC.uk')?.sources.length,2);assert.ok(result.some(c=>c.name.includes('Asia')));
});
test('name matching does not merge different countries or languages',()=>{
 const result=mergePublicChannels(parsePublicM3u(playlist([row('','Sport 1 HD','https://tv.example/a.m3u8','tvg-country="US"'),row('','Sport 1 SD','https://tv.example/b.m3u8','tvg-country="FR"'),row('','Sport 1 SD','https://tv.example/c.m3u8','tvg-country="FR" tvg-language="Arabic"'),row('','Sport 2','https://tv.example/d.m3u8','tvg-country="FR"')]),'test'));assert.equal(result.length,4);
});
test('ignores adult, credentials and unsupported schemes',()=>{const result=parsePublicM3u(playlist([row('a','Adult XXX','https://tv.example/a.m3u8'),row('b','B','file:///etc/passwd'),row('c','C','https://user:secret@tv.example/a.m3u8'),row('d','D','https://tv.example/d.mp4')]),'test');assert.equal(result.length,1);assert.equal(result[0].name,'D');assert.throws(()=>parsePublicM3u('<html>Error</html>','test'));});
