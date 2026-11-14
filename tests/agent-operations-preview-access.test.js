'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {ORIGIN,allowed,oidcHeaders,previewTransport,offlineFonts}=require('../scripts/agent-operations-preview-access.cjs');
const claims={project_id:'prj_AkD7VoSNCE6fRYXQnXkX1ywGqjLX',owner_id:'team_6Rg3DdCrvOml6oEGwx6Ndf1I',environment:'development',nbf:0,exp:900};
const token=(change={})=>'fixture.'+Buffer.from(JSON.stringify({...claims,...change})).toString('base64url')+'.not-a-real-signature';
test('licensed pinned fonts are fulfilled offline only for exact stylesheet and font requests',()=>{
  const manifest=require('../scripts/agent-operations-fonts/manifest.json'),read=offlineFonts();
  assert.equal(read({url:manifest.cssUrl,method:'GET',type:'stylesheet'}).contentType,'text/css');
  for(const f of manifest.fonts)assert.ok(read({url:ORIGIN+'/__agentops_fonts/'+f.file,method:'GET',type:'font'}).body.length>0);
  for(const r of [{url:manifest.cssUrl,method:'POST',type:'stylesheet'},{url:manifest.cssUrl+'&other=1',method:'GET',type:'stylesheet'},{url:manifest.cssUrl,method:'GET',type:'document'},{url:manifest.fonts[0].source,method:'GET',type:'font'}])assert.equal(read(r),null);
});
test('Preview request scope permits only pinned documents and explicit render resources',()=>{
  for(const p of ['/','/industries/legal'])assert.ok(allowed(ORIGIN+p,'GET','document'));
  assert.ok(allowed(ORIGIN+'/industry-refinement.css','GET','stylesheet'));
  for(const p of ['/admin','/login','/api/agent-operations','/industries/growth','/anything.js','/?x=1','/industries/legal?x=1','/%61dmin','/industries/legal#x'])assert.equal(allowed(ORIGIN+p,'GET','document'),false,p);
  for(const method of ['POST','PUT','DELETE','HEAD'])assert.equal(allowed(ORIGIN+'/',''+method,'document'),false);
  for(const url of ['https://www.callercore.com/','https://example.com/','https://my-ai-website-1kyf1znjt-mohamtaj004bas-projects.vercel.app/','https://user:password@'+new URL(ORIGIN).host+'/'])assert.equal(allowed(url,'GET','document'),false);
  assert.equal(allowed(ORIGIN+'/site.js','GET','document'),false);
  assert.equal(allowed(ORIGIN+'/site.js','GET','fetch'),false);
});
test('Preview identity preflight rejects absent, expired, foreign and Production identities',()=>{
  assert.ok(oidcHeaders(token(),1000));
  for(const t of [undefined,'bad',token({environment:'production'}),token({environment:'preview'}),token({project_id:'foreign'}),token({owner_id:'foreign'}),token({exp:1}),token({exp:'900'}),token({nbf:3})])assert.throws(()=>oidcHeaders(t,1000));
});
test('transport refuses denied scope before network and forwards no browser cookies or secret response headers',async()=>{
  let calls=0;
  const transport=previewTransport({token:token(),clock:()=>1000,fetchImpl:async(url,opts)=>{
    calls++;assert.equal(url,ORIGIN+'/');assert.equal(opts.redirect,'error');assert.deepEqual(Object.keys(opts.headers),['x-vercel-trusted-oidc-idp-token']);
    return new Response('<html>fixture</html>',{headers:{'content-type':'text/html','set-cookie':'secret-cookie','x-vercel-token':'never-forward'}});
  }});
  await assert.rejects(transport({url:ORIGIN+'/admin',method:'GET',type:'document'}));assert.equal(calls,0);
  const result=await transport({url:ORIGIN+'/',method:'GET',type:'document',headers:{cookie:'owner-session'}});
  assert.deepEqual(Object.keys(result),['status','contentType','body']);assert.equal(calls,1);
});
test('transport fails closed on redirect, denied provider response, expiry, cancellation and oversized resource',async()=>{
  for(const response of [new Response('',{status:302,headers:{location:'https://example.com'}}),new Response('',{status:401}),new Response('x'.repeat(5000001),{headers:{'content-type':'text/html'}})]){
    const transport=previewTransport({token:token(),clock:()=>1000,fetchImpl:async()=>response});
    await assert.rejects(transport({url:ORIGIN+'/',method:'GET',type:'document'}));
  }
  let now=1000,calls=0;const controller=new AbortController();
  const transport=previewTransport({token:token(),clock:()=>now,signal:controller.signal,fetchImpl:async()=>{calls++;}});
  now=601001;await assert.rejects(transport({url:ORIGIN+'/',method:'GET',type:'document'}));
  now=1000;controller.abort();await assert.rejects(transport({url:ORIGIN+'/',method:'GET',type:'document'}));assert.equal(calls,0);
});
test('request 257 and identity expiry are denied before network access',async()=>{
  let now=1000,calls=0;
  const transport=previewTransport({token:token(),clock:()=>now,fetchImpl:async()=>{calls++;return new Response('body',{headers:{'content-type':'text/html'}});}});
  for(let i=0;i<256;i++)await transport({url:ORIGIN+'/',method:'GET',type:'document'});
  await assert.rejects(transport({url:ORIGIN+'/',method:'GET',type:'document'}));assert.equal(calls,256);
  const expires=previewTransport({token:token({exp:2}),clock:()=>now,fetchImpl:async()=>{calls++;}});
  now=2000;await assert.rejects(expires({url:ORIGIN+'/',method:'GET',type:'document'}));assert.equal(calls,256);
});
