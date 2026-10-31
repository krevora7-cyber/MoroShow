import {createDecipheriv} from 'node:crypto';
// ShortMax's public player transport envelope: a 1024-byte header contains the
// per-segment key and length. This is not an HLS TS stream until decoded.
export function decodeShortsSegment(bytes:Buffer,url:string):Buffer{
 const u=new URL(url);
 if(!u.pathname.includes('hls-encrypted')||!u.pathname.endsWith('.ts'))return bytes;
 if(bytes.length<1040)throw Error('Incomplete Shorts segment');
 const offset=Number(bytes.subarray(16,20).toString('ascii')),length=Number(bytes.subarray(20,24).toString('ascii'));
 if(!Number.isInteger(offset)||offset<24||offset+16>1024||!Number.isInteger(length)||length<=0||length%16||1024+length>bytes.length)throw Error('Invalid Shorts segment header');
 const full=u.pathname.includes('hls-encrypted-full'),ciphertext=bytes.subarray(1024,full?undefined:1024+length);
 if(ciphertext.length%16)throw Error('Incomplete encrypted segment');
 const decipher=createDecipheriv('aes-128-cbc',bytes.subarray(offset,offset+16),Buffer.from('shortmax00000000'));
 return Buffer.concat([decipher.update(ciphertext),decipher.final(),...(full?[]:[bytes.subarray(1024+length)])]);
}
