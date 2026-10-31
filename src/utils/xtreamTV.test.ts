import test from 'node:test';
import assert from 'node:assert/strict';
import {configFromM3u,loadXtreamTV} from '../server/xtream';
test('TV import requests channels only, keeping Xtream movies and series out of CNC',async()=>{
 const config=configFromM3u('https://tv.example.test/get.php?username=test&password=test')!;const calls:string[]=[];
 const request=async(url:any)=>{const action=new URL(String(url)).searchParams.get('action')!;calls.push(action);return new Response(JSON.stringify(action==='get_live_categories'?[{category_id:'1',category_name:'News'}]:[{stream_id:9,name:'News Channel',category_id:'1'}]));};
 const result=await loadXtreamTV(config,request as typeof fetch);
 assert.deepEqual(calls.sort(),['get_live_categories','get_live_streams']);assert.equal(result.items.length,1);assert.equal(result.items[0].kind,'live');assert.equal(result.items[0].category,'News');
});
