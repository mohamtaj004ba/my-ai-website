'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const draft=require('../scripts/agent-operations-draft-workspace.cjs'),tools=require('../lib/agent-operations-engineering-tools');
const sourceSha='a'.repeat(40),options={sourceSha,expectedSourceSha:sourceSha};
const dirs=()=>fs.readdirSync(os.tmpdir()).filter(x=>x.startsWith('callercore-draft-'+process.pid+'-')).sort();
test('actual permission-restricted child creates inspectable patch and destroys draft without repository mutation',async()=>{
 const before=tools.hash(tools.readFile('dashboard.html')),existing=dirs(),r=await draft.prepare(options);
 assert.equal(r.files[0].beforeSha256,before);assert.notEqual(r.files[0].afterSha256,before);assert.equal(r.patchSha256,tools.hash(r.patch));assert.equal(r.publicationAllowed,false);assert.deepEqual(r.cleanup,{destroyed:true});assert.equal(tools.hash(tools.readFile('dashboard.html')),before);assert.deepEqual(dirs(),existing);
});
test('source substitution, arbitrary path, secret options and exceeded limits fail before creation',async()=>{
 const before=dirs();for(const args of [{...options,sourceSha:'b'.repeat(40)},{...options,sourceSha:'main'},{...options,files:['../secret']},{...options,apiKey:'secret'},{...options,timeoutMs:10001},{...options,delayMs:-1}])await assert.rejects(draft.prepare(args),/DRAFT_/);assert.deepEqual(dirs(),before);
});
test('already cancelled and genuine mid-child cancellation leave no workspace',async()=>{
 const before=dirs(),already=new AbortController();already.abort();await assert.rejects(draft.prepare({...options,signal:already.signal}),/DRAFT_CANCELLED/);
 const c=new AbortController(),pending=draft.prepare({...options,signal:c.signal,delayMs:2000});setTimeout(()=>c.abort(),150);await assert.rejects(pending,/DRAFT_CANCELLED/);assert.deepEqual(dirs(),before);
});
test('actual child timeout terminates and cleans workspace',async()=>{const before=dirs();await assert.rejects(draft.prepare({...options,delayMs:2000,timeoutMs:100}),/DRAFT_TIMEOUT/);assert.deepEqual(dirs(),before);});
test('child rejects tampered preimage and traversal; no alternate operation exists',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'callercore-child-test-')),entry=path.resolve(__dirname,'../scripts/agent-operations-draft-child.cjs');
 try{fs.writeFileSync(path.join(root,'dashboard.html'),'safe');for(const file of [{path:'dashboard.html',sha256:'0'.repeat(64)},{path:'../outside.html',sha256:tools.hash('safe')}]){const r=spawnSync(process.execPath,['--permission',`--allow-fs-read=${entry}`,`--allow-fs-read=${root}`,`--allow-fs-write=${root}`,entry],{cwd:root,env:{},encoding:'utf8',input:JSON.stringify({version:'draft-data-v1',files:[file],delayMs:0}),timeout:3000,windowsHide:true});assert.notEqual(r.status,0);assert.equal(r.stderr,'DRAFT_CHILD_DENIED');assert.equal(fs.readFileSync(path.join(root,'dashboard.html'),'utf8'),'safe');}}
 finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('recognized secrets cannot enter draft text through the curated source safety screen',()=>{assert.throws(()=>tools.safeText(Buffer.from('sk-proj-'+ 'a'.repeat(30))),/ENG_SOURCE_SECRET/);});
test('pure persisted receipt validation rejects forged writes, patch, evidence and cleanup',async()=>{
 const artifact=await draft.prepare(options);assert.equal(draft.validateArtifact(artifact,{sourceSha}),true);
 for(const change of [r=>r.publicationAllowed=true,r=>r.limits.network=true,r=>r.limits.externalCodeExecution=true,r=>r.patch.addedText='<script>bad</script>',r=>r.patchSha256='0'.repeat(64),r=>r.files[0].afterSha256='0'.repeat(64),r=>r.files[0].path='../outside',r=>r.cleanup.destroyed=false,r=>r.branch='main',r=>r.sourceSha='b'.repeat(40),r=>r.sourceManifestHash='0'.repeat(64),r=>r.writeAuthority=true]){const tampered=structuredClone(artifact);change(tampered);assert.throws(()=>draft.validateArtifact(tampered,{sourceSha}),/DRAFT_/);}
});
