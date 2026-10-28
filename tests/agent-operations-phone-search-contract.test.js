'use strict';
const test=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const task=require('../lib/agent-operations-phone-search'),draft=require('../lib/agent-operations-draft-proposal'),tools=require('../lib/agent-operations-engineering-tools');
function fixture(){
 const binding={ownerHash:'a'.repeat(64),workspaceHash:'b'.repeat(64),taskId:'task_phone_fixture',executionId:'execution_phone_fixture',sourceCommit:'c'.repeat(40),deploymentId:'dpl_fixture',origin:'https://my-ai-website-fixture-mohamtaj004bas-projects.vercel.app',releaseHash:'d'.repeat(64),contextHash:'e'.repeat(64)},context=task.context(binding);
 // A comment-only contract fixture, NOT a phone-search correction or model output.
 const value={version:draft.BUNDLE_VERSION,binding:structuredClone(binding),files:context.files.map(f=>({path:f.path,preimageSha256:f.sha256,edits:f.sites.map(s=>({offset:f.text.indexOf(s.before),before:s.before,after:s.before+'/* inert contract fixture */',beforeSha256:draft.hash(s.before)})).sort((x,y)=>x.offset-y.offset)}))};
 return{value,context};
}
test('two-file scope authenticates five exact source sites without changing historical source capture',()=>{
 const s=task.snapshot();a.equal(s.files.length,2);a.equal(s.evidence.length,5);a.deepEqual(s.files.map(f=>f.sites.length),[4,1]);a.equal(s.executionAuthorized,false);a.equal(s.publicationAllowed,false);
 const generic=tools.captureApproved();a.equal(generic.manifest.files.length,4);a.equal(Object.hasOwn(generic.texts,'lib/conversation-history.js'),false);a.throws(()=>tools.readFile('lib/conversation-history.js'),/ENG_FILE_DENIED/);
 const assignment=task.assignment();a.equal(assignment.liveTaskRegistered,false);a.equal(assignment.criteria.length,4);a.equal(assignment.scopeHash,s.scopeHash);
});
test('data-only application reuses text validators and preserves every out-of-scope byte',()=>{
 const {value,context}=fixture(),before=context.files.map(f=>f.text),result=task.apply(value,context);
 a.equal(result.files.length,2);a.equal(result.executionAuthorized,false);a.equal(result.publicationAllowed,false);a.equal(result.proposalHash,draft.hash(value));
 result.files.forEach((file,i)=>{a.equal(file.text.split('/* inert contract fixture */').join(''),before[i]);a.equal(file.afterSha256,draft.hash(file.text));a.equal(fs.readFileSync(path.join(__dirname,'..',file.path),'utf8').replace(/\r\n/g,'\n'),before[i]);});
 a.deepEqual(context.files.map(f=>f.text),before);
});
for(const[name,mutate]of [
 ['path traversal',v=>v.files[1].path='../conversation-history.js'],
 ['absolute path',v=>v.files[1].path='C:/conversation-history.js'],
 ['encoded traversal',v=>v.files[1].path='lib/%2e%2e/dashboard.js'],
 ['backslash path',v=>v.files[1].path='lib\\conversation-history.js'],
 ['protected file',v=>v.files[1].path='lib/agent-operations-activation-controller.js'],
 ['new file',v=>v.files.push(v.files[0])],
 ['missing backend',v=>v.files.pop()],
 ['reordered files',v=>v.files.reverse()],
 ['duplicate file',v=>v.files[1]=structuredClone(v.files[0])],
 ['stale source',v=>v.files[1].preimageSha256='0'.repeat(64)],
 ['cross workspace',v=>v.binding.workspaceHash='0'.repeat(64)],
 ['cross owner',v=>v.binding.ownerHash='0'.repeat(64)],
 ['stale task',v=>v.binding.taskId='other_task'],
 ['replayed execution',v=>v.binding.executionId='old_execution'],
 ['other release',v=>v.binding.releaseHash='0'.repeat(64)],
 ['other deployment',v=>v.binding.deploymentId='dpl_other'],
 ['other source commit',v=>v.binding.sourceCommit='0'.repeat(40)],
 ['partial surface correction',v=>v.files[0].edits.pop()],
 ['duplicate site',v=>v.files[0].edits[1]=structuredClone(v.files[0].edits[0])],
 ['overlap',v=>v.files[0].edits[1].offset=v.files[0].edits[0].offset],
 ['forged offset',v=>v.files[1].edits[0].offset++],
 ['forged preimage',v=>v.files[1].edits[0].before='return true'],
 ['forged preimage hash',v=>v.files[1].edits[0].beforeSha256='0'.repeat(64)],
 ['extra authority',v=>v.publicationAllowed=true],
 ['extra command',v=>v.files[0].command='npm install anything'],
 ['extra edit field',v=>v.files[0].edits[0].execute=true],
 ['oversize output',v=>v.files[0].edits[0].after='x'.repeat(2049)],
 ['no change',v=>v.files[0].edits[0].after=v.files[0].edits[0].before],
 ['NUL',v=>v.files[0].edits[0].after+='\u0000'],
 ['hidden bidi',v=>v.files[0].edits[0].after+='\u202e']
])test('bundle denies '+name,()=>{const{value,context}=fixture();mutate(value);a.throws(()=>task.apply(value,context),/DRAFT_|PHONE_SEARCH_/);});
test('forged trusted source context cannot expand phone task scope',()=>{const{value,context}=fixture();context.files[0].sites[0].before='unrelated code';a.throws(()=>task.apply(value,context),/PHONE_SEARCH_SOURCE_DRIFT/);});
test('generic one-file worker does not accept a bundle or backend path',()=>{const{value,context}=fixture();a.throws(()=>draft.apply(context.files[0].text,value),/DRAFT_PROPOSAL_DENIED/);const f=value.files[1];a.throws(()=>draft.validate({version:draft.VERSION,path:f.path,sourceSha:value.binding.sourceCommit,preimageSha256:f.preimageSha256,binding:value.binding,edits:f.edits}),/DRAFT_PROPOSAL_DENIED/);});
test('malformed contexts fail with closed diagnostic codes',()=>{const{value,context}=fixture();for(const c of [null,{}, {...context,files:[]}, {...context,binding:{}}])a.throws(()=>draft.validateBundle(value,c),/DRAFT_BUNDLE_/);});
test('model wire rejects duplicate and escape-equivalent keys before JSON decode',()=>{
 const{value,context}=fixture(),wire=JSON.stringify(value);a.deepEqual(task.parse(wire,context),value);
 for(const duplicate of ['"taskId":"forged","taskId":','"ta\\u0073kId":"forged","taskId":'])a.throws(()=>task.parse(wire.replace('"taskId":',duplicate),context),/IMPLEMENTATION_AMBIGUOUS_JSON/);
 a.throws(()=>task.parse('{"binding":',context),/IMPLEMENTATION_JSON/);a.throws(()=>task.parse('x'.repeat(24001),context),/IMPLEMENTATION_BOUNDS/);
});
test('strict model schema contains fixed identity, exact source sites and no prescribed correction',()=>{
 const{context}=fixture(),s=task.schema(context);a.equal(s.additionalProperties,false);a.equal(s.properties.files.minItems,2);a.equal(s.properties.files.maxItems,2);
 const variants=s.properties.files.items.anyOf;a.deepEqual(variants.map(v=>v.properties.path.enum[0]),context.files.map(f=>f.path));
 variants.forEach((v,i)=>{a.equal(v.additionalProperties,false);a.equal(v.properties.edits.minItems,context.files[i].sites.length);for(const edit of v.properties.edits.items.anyOf){a.equal(edit.additionalProperties,false);a.equal(edit.properties.offset.enum.length,1);a.equal(edit.properties.before.enum.length,1);a.equal(edit.properties.after.enum,undefined);}});
});
test('hostile replacement remains inert text, never a claim of executable safety',()=>{
 const{value,context}=fixture();delete globalThis.__phoneContractExecuted;
 value.files[0].edits[0].after='(!q||hay.includes(q)||(()=>{globalThis.__phoneContractExecuted=true;return false;})())';
 const result=task.apply(value,context);a.equal(globalThis.__phoneContractExecuted,undefined);a.equal(result.executionAuthorized,false);a.equal(result.publicationAllowed,false);a(result.files[0].text.includes('globalThis.__phoneContractExecuted=true'));
 a.throws(()=>draft.validate(value),/DRAFT_PROPOSAL_DENIED/);
});
test('metadata import neither reads backend source nor grants new filesystem access',()=>{
 const {spawnSync}=require('node:child_process'),root=path.resolve(__dirname,'..');
 const script="const fs=require('node:fs');const read=fs.readFileSync;fs.readFileSync=function(file,...args){if(String(file).endsWith('conversation-history.js'))throw Error('unexpected source read');return read.call(this,file,...args)};const t=require('./lib/agent-operations-engineering-tools');if(typeof t.readPhoneSearchSource!=='function')throw Error('missing');";
 const run=spawnSync(process.execPath,['-e',script],{cwd:root,encoding:'utf8',timeout:10000});a.equal(run.status,0,run.stderr);
});
test('actual restricted child cannot read the new backend source without an explicit read grant',()=>{
 const{spawnSync}=require('node:child_process'),root=path.resolve(__dirname,'..'),modulePath=path.join(root,'lib/agent-operations-engineering-tools.js');
 const script="const t=require("+JSON.stringify(modulePath)+");try{t.readPhoneSearchSource('lib/conversation-history.js');process.exit(9)}catch(e){if(e.code!=='ERR_ACCESS_DENIED')throw e;process.stdout.write('read-denied')}";
 const run=spawnSync(process.execPath,['--permission','--allow-fs-read='+modulePath,'-e',script],{cwd:root,encoding:'utf8',timeout:10000});a.equal(run.status,0,run.stderr);a.equal(run.stdout,'read-denied');
});
test('existing restricted data worker applies both fixture files and confirms disposal without executing replacement text',async()=>{
 const{value,context}=fixture(),workspace=require('../scripts/agent-operations-draft-workspace.cjs'),phases=[],before=task.snapshot().files.map(f=>f.sha256);
 value.files[0].edits[0].after='(!q||hay.includes(q)||(()=>{globalThis.__phoneContractExecuted=true;return false;})())';
 const result=await workspace.prepareBundle({proposal:value,binding:context.binding,authorize:async phase=>{phases.push(phase);return true;}});
 a.deepEqual(phases,['before','after']);a.equal(result.cleanup.destroyed,true);a.equal(result.sourceExecuted,false);a.equal(result.syntaxValidated,true);a.equal(result.executionAuthorized,false);a.equal(result.publicationAllowed,false);a.equal(result.files.length,2);a.equal(globalThis.__phoneContractExecuted,undefined);a.deepEqual(task.snapshot().files.map(f=>f.sha256),before);
});
test('malformed generated syntax fails with a stable code before returning an applied artifact',async()=>{
 const{value,context}=fixture(),workspace=require('../scripts/agent-operations-draft-workspace.cjs');value.files[1].edits[0].after='this is not valid JavaScript {';
 await a.rejects(workspace.prepareBundle({proposal:value,binding:context.binding,authorize:async()=>true}),e=>e.message==='DRAFT_BUNDLE_SYNTAX');
});
test('bundle worker refuses missing or revoked authority and preserves original source',async()=>{
 const{value,context}=fixture(),workspace=require('../scripts/agent-operations-draft-workspace.cjs');
 await a.rejects(workspace.prepareBundle({proposal:value,binding:context.binding}),/DRAFT_PROPOSAL_AUTHORITY_REQUIRED/);
 for(const deniedPhase of ['before','after'])await a.rejects(workspace.prepareBundle({proposal:value,binding:context.binding,authorize:async phase=>phase!==deniedPhase}),/DRAFT_PROPOSAL_AUTHORITY_DENIED/);
});
test('canceled or timed out bundle authority cannot create a late disposable operation',async()=>{
 const{value,context}=fixture(),workspace=require('../scripts/agent-operations-draft-workspace.cjs'),controller=new AbortController();controller.abort();
 await a.rejects(workspace.prepareBundle({proposal:value,binding:context.binding,authorize:async()=>true,signal:controller.signal}),/DRAFT_CANCELLED/);
 let calls=0;await a.rejects(workspace.prepareBundle({proposal:value,binding:context.binding,authorityTimeoutMs:10,authorize:async()=>{calls++;await new Promise(r=>setTimeout(r,35));return true;}}),/DRAFT_TIMEOUT/);
 await new Promise(r=>setTimeout(r,45));a.equal(calls,1);
});
test('cleanup failure is closed and never leaks the underlying filesystem exception',async()=>{
 const{value,context}=fixture(),workspace=require('../scripts/agent-operations-draft-workspace.cjs'),original=fs.rmSync;
 fs.rmSync=function(target,options){const result=original.call(this,target,options);if(String(target).includes('callercore-proposed-bundle-'))throw Error('fictional private path and secret');return result;};
 try{await a.rejects(workspace.prepareBundle({proposal:value,binding:context.binding,authorize:async()=>true}),e=>e.message==='DRAFT_CLEANUP_FAILED'&&e.cleanupConfirmed===false&&!JSON.stringify(e).includes('fictional'));}finally{fs.rmSync=original;}
});
test('post-worker authority rejection still waits for actual disposal',async()=>{
 const{value,context}=fixture(),workspace=require('../scripts/agent-operations-draft-workspace.cjs'),original=fs.rmSync,removed=[];
 fs.rmSync=function(target,options){const result=original.call(this,target,options);if(String(target).includes('callercore-proposed-bundle-'))removed.push(target);return result;};
 try{await a.rejects(workspace.prepareBundle({proposal:value,binding:context.binding,authorize:async phase=>phase==='before'}),/DRAFT_PROPOSAL_AUTHORITY_DENIED/);a.equal(removed.length,1);a.equal(fs.existsSync(removed[0]),false);}finally{fs.rmSync=original;}
});
