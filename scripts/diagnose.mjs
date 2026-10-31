// Local-only, read-only NetShow diagnostic — never prints provider credentials.
const base = 'http://127.0.0.1:'+(process.env.PORT||3000);
const get = async path => {const r=await fetch(base+path,{signal:AbortSignal.timeout(18000)});return {http:r.status,body:await r.json()};};
try {
  const status=await get('/api/source-status');
  const data=status.body;
  console.log('Catalog:', JSON.stringify({ready:data.ready,counts:data.counts,sourceMode:data.sourceMode,error:data.error,warnings:data.warnings}));
  if (!data.ready) {console.log('Not ready; no playback test possible.');process.exit(1);}
  const live=await get('/api/dev/diagnose-first-channel');
  console.log('First real channel:',JSON.stringify(live.body));
  console.log('This checks the provider response, not whether Chrome can decode its codec.');
} catch(e) {console.log('Local diagnostic failed:',e.message);process.exitCode=1;}
