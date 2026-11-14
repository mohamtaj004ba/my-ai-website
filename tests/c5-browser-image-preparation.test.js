'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const q=require('../scripts/c5-browser-image-verify.cjs'),manifest=require('../docs/c5-browser-image-manifest.json');
test('browser image proposal requires exact pinned version/platform-digest reference and no active allowance',()=>{assert(q.baseAllowed('mcr.microsoft.com/playwright:v1.55.0-noble@sha256:'+'a'.repeat(64)));for(const ref of ['mcr.microsoft.com/playwright:latest','mcr.microsoft.com/playwright:v1.55.0-noble','evil.example/playwright:v1.55.0-noble@sha256:'+'a'.repeat(64),'mcr.microsoft.com/playwright:v1.56.0-noble@sha256:'+'a'.repeat(64)])assert.equal(q.baseAllowed(ref),false);assert.equal(manifest.baseDigest,null);assert.equal(manifest.imageCreated,false);assert.equal(manifest.sandboxCreated,false);assert.equal(manifest.priorAllowanceRenewed,false);});
test('native diagnostics preserve exact safe names and strip unrelated output rather than invent dependencies',()=>{assert.deepEqual(q.libraryNames(' libnss3.so => not found\n libnss3.so => not found\n libexample.so.1 => not found\n PRIVATE_TOKEN=secret\n'),['libexample.so.1','libnss3.so']);assert.deepEqual(q.distribution('ID=ubuntu\nVERSION_ID="24.04"\nSECRET=private\n'),{ID:'ubuntu',VERSION_ID:'24.04'});assert.throws(()=>q.distribution('ID="bad value"\n'));});
test('recipe has no implicit latest/network installation, uses verified archives and keeps execution external',()=>{const source=fs.readFileSync(require.resolve('../docs/c5-browser-image.Dockerfile'),'utf8');assert(source.includes('ARG BASE_IMAGE\nFROM ${BASE_IMAGE}'));assert(source.includes('USER pwuser'));assert(source.indexOf('RUN node /opt/callercore-browser/c5-browser-image-verify.cjs --dependencies-only')>source.indexOf('USER pwuser'));assert.equal(source.split('--dependencies-only').length-1,1);assert(!/^\s*(EXPOSE|ENTRYPOINT|CMD)\b/m.test(source));assert(!/apt-get|npm install|curl |wget /i.test(source));for(const a of manifest.assets)assert(source.includes(a.sha256));assert.equal(manifest.headlessShellSha256,q.BINARY_SHA);assert.deepEqual(manifest.orchestratorRequirements.ports,[]);assert.equal(manifest.orchestratorRequirements.networkPolicy,'deny-all');assert.equal(manifest.orchestratorRequirements.credentialsInVm,false);assert.equal(manifest.orchestratorRequirements.automaticResume,false);});

test('qualifier requires non-root Linux x64 execution for both modes and exact Ubuntu release',()=>{
 const configuration={mode:'--fixed-fixture',platform:'linux',arch:'x64',uid:1000,baseImage:'mcr.microsoft.com/playwright:v1.55.0-noble@sha256:'+'a'.repeat(64)};
 for(const mode of ['--dependencies-only','--fixed-fixture']){assert.doesNotThrow(()=>q.configuration({...configuration,mode}));for(const uid of [0,-1,undefined,NaN,1.5,'1000'])assert.throws(()=>q.configuration({...configuration,mode,uid}),/CONFIGURATION/);}
 for(const changed of [{platform:'win32'},{arch:'arm64'},{mode:'--arbitrary'},{baseImage:'latest'}])assert.throws(()=>q.configuration({...configuration,...changed}),/CONFIGURATION/);
 assert.deepEqual(q.requireDistribution(q.distribution('ID=ubuntu\nVERSION_ID="24.04"\nSECRET=private')),{ID:'ubuntu',VERSION_ID:'24.04'});
 for(const os of [{},{ID:'debian',VERSION_ID:'24.04'},{ID:'ubuntu',VERSION_ID:'22.04'},{ID:'ubuntu'}])assert.throws(()=>q.requireDistribution(os),/OS_IDENTITY/);
});

test('fixed proof requires PNG signature and minimum size positive finite geometry and local fixture URL',()=>{
 const image=Buffer.alloc(1024);Buffer.from([137,80,78,71,13,10,26,10]).copy(image);const geometry={x:8,y:8,width:1264,height:100},proof=q.fixtureFacts(image,{...geometry,PRIVATE_TOKEN:'excluded'},'about:blank');
 assert.equal(proof.bytes,1024);assert.match(proof.screenshotHash,/^[a-f0-9]{64}$/);assert.deepEqual(proof.geometry,geometry);assert.equal(proof.protectedPreviewVerified,false);assert(!JSON.stringify(proof).includes('PRIVATE'));
 for(const invalid of [Buffer.alloc(1024),image.subarray(0,1023),new Uint8Array(image),null])assert.throws(()=>q.fixtureFacts(invalid,geometry,'about:blank'),/PNG_INVALID/);
 for(const invalid of [null,{...geometry,width:0},{...geometry,height:-1},{...geometry,x:NaN},{...geometry,y:Infinity},{...geometry,x:-1},{...geometry,width:'10'}])assert.throws(()=>q.fixtureFacts(image,invalid,'about:blank'),/GEOMETRY_OR_URL/);
 for(const url of ['https://preview.vercel.app','about:blank#fragment','data:text/html,fixture','file:///etc/passwd'])assert.throws(()=>q.fixtureFacts(image,geometry,url),/GEOMETRY_OR_URL/);
});

test('cleanup attempts browser even when context rejects or stalls and never reports confirmed cleanup',async()=>{
 for(const failure of ['reject','stall']){const calls=[],context={close:()=>{calls.push('context');return failure==='reject'?Promise.reject(Error('PRIVATE')):new Promise(()=>{});}},browser={close:async()=>calls.push('browser')};
  await assert.rejects(q.closeSafely(context,browser,10),/^Error: C5_BROWSER_CLEANUP_UNCONFIRMED$/);assert.deepEqual(calls,['context','browser']);
 }
 const calls=[];await q.closeSafely({close:async()=>calls.push('context')},{close:async()=>calls.push('browser')},10);assert.deepEqual(calls,['context','browser']);await q.closeSafely(undefined,undefined,10);
 await assert.rejects(q.closeSafely(null,{close:async()=>{throw Error('PRIVATE');}},10),/^Error: C5_BROWSER_CLEANUP_UNCONFIRMED$/);
});
