'use strict';
require('./helpers/historical-starter-fixture.cjs'); // Explicit pre-fix offline task replay.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const d=require('../lib/agent-operations-source-test-dispatch');
function job(taskId='source_test_1'){
 const baseline=require('../lib/agent-operations-implementation').snapshot().text;
 const patched=baseline.replace("    ['automations',d=>{automationsData=d.automations||[]}],","    ...(has('automations') ? [['automations',d=>{automationsData=d.automations||[]}]] : []),");
 return d.prepare({binding:{ownerHash:'a'.repeat(64),workspaceHash:'b'.repeat(64),releaseHash:'c'.repeat(64),sourceCommit:'d'.repeat(40),deploymentId:'dpl_Test',planId:'plan_1',taskId,executionId:taskId+'_execution'},baseline,patched,proposalHash:'e'.repeat(64)});
}
function outcome(j){
 const row=(label,exitCode)=>({label,exitCode,timedOut:false,outputLimit:false,spawnFailed:false});
 const q={...row('qualification',0),output:{passed:true,checks:Object.fromEntries(d.CHECKS.map(k=>[k,true]))}};
 const s={...row('starter',0),programSha256:j.manifest.testProgramHash,output:{passed:true,tests:d.TESTS.map(id=>({id,passed:true}))}};
 return{exitCode:0,stdout:JSON.stringify({version:'source-isolated-runner-result-v1',mode:'starter',programSha256:j.manifest.commandHash,testProgramSha256:j.manifest.testProgramHash,sourceHashes:j.manifest.sourceHashes,qualificationPassed:true,runPassed:true,protectedIntegrity:true,cleanupConfirmed:true,publicationAuthorized:false,independentlyAccepted:false,results:[q,row('positive',0),row('seeded-failure',1),{label:'timeout',timedOut:true,signal:'SIGKILL',childStarted:true,descendantsTerminated:true},s]})};
}
function fixture(j,options={}){
 const calls=[],receipts=[];let claimed=false,session=null;
 const journal={async claim(m){calls.push('claim');if(claimed||options.denied)throw Error('ENG_TEST_PERMISSION');claimed=true;return{id:'f'.repeat(32),manifestHash:m.hash,expiresAt:100000};},async verify(){calls.push('verify');if(options.revoked)throw Error('ENG_TEST_REVOKED');},async started(_p,id){calls.push('started');assert.equal(id,'sbx_Test');},async close(_p,r){calls.push('close');receipts.push(r);}};
 const provider={async create(input){calls.push('create');assert.equal(input.persistent,false);assert.deepEqual(input.env,{});assert.deepEqual(input.networkPolicy,{mode:'deny-all'});session={id:'sbx_Test',name:input.name,projectId:d.PROJECT,image:d.IMAGE,vcpus:1,memory:2048,timeout:300000,persistent:false,networkPolicy:{mode:'deny-all'},routes:[]};if(options.lostAck)throw Error('SECRET_PROVIDER_CREDENTIAL');return session;},async run(){calls.push('run');return options.malformed?{exitCode:0,stdout:'SECRET_RAW_MODEL_CONTENT'}:outcome(j);},async find(){calls.push('find');return session;},async stop(){calls.push('stop');},async read(){calls.push('read');return{id:'sbx_Test',name:session.name,projectId:d.PROJECT,status:options.cleanupFailure?'running':'stopped'};}};
 return{journal,provider,calls,receipts,clock:()=>1};
}
test('source-bound dispatch claims once before create, verifies before execution and closes only after stopped readback',async()=>{
 const j=job(),f=fixture(j);const r=await d.dispatch({job:j,...f});assert.equal(r.sourceExecuted,true);assert.equal(r.tests.length,7);assert.equal(r.publicationAuthorized,false);
 assert(f.calls.indexOf('claim')<f.calls.indexOf('create'));assert(f.calls.indexOf('started')<f.calls.indexOf('run'));assert(f.calls.indexOf('read')<f.calls.indexOf('close'));assert.equal(f.receipts[0].status,'completed');
 await assert.rejects(d.dispatch({job:j,...f}),/ENG_TEST_PERMISSION/);assert.equal(f.calls.filter(x=>x==='create').length,1);
});
test('forged preparation, command substitution and another task result fail without new execution',async()=>{
 const j=job(),f=fixture(j);await assert.rejects(d.dispatch({job:structuredClone(j),...f}),/ENG_TEST_PREPARATION_PROVENANCE/);assert.equal(f.calls.length,0);
 j.command.args[0]='SECRET_COMMAND';await assert.rejects(d.dispatch({job:j,...f}),/ENG_TEST_PREPARATION_PROVENANCE/);assert.equal(f.calls.length,0);
 const a=job('task_a'),b=job('task_b');assert.notEqual(a.manifest.commandHash,b.manifest.commandHash);assert.throws(()=>d.validateReport(b,outcome(a)),/ENG_TEST_RESULT_BINDING/);
});
test('denied and revoked permission never dispatch generated source',async()=>{
 for(const option of ['denied','revoked']){const j=job(),f=fixture(j,{[option]:true});await assert.rejects(d.dispatch({job:j,...f}),/ENG_TEST_/);assert(!f.calls.includes('create'));assert(!f.calls.includes('run'));}
});
test('lost create acknowledgment is reconciled and stopped, never automatically retried',async()=>{
 const j=job(),f=fixture(j,{lostAck:true});await assert.rejects(d.dispatch({job:j,...f}),/ENG_TEST_PROVIDER_UNCONFIRMED/);assert.equal(f.calls.filter(x=>x==='create').length,1);assert(f.calls.includes('find'));assert(f.calls.includes('stop'));assert.equal(f.receipts[0].stopConfirmed,true);assert(!JSON.stringify(f.receipts).includes('SECRET_'));
});
test('malformed output and failed stop readback fail closed with sanitized durable failure',async()=>{
 for(const option of ['malformed','cleanupFailure']){const j=job(),f=fixture(j,{[option]:true});await assert.rejects(d.dispatch({job:j,...f}),/ENG_TEST_/);assert.equal(f.receipts[0].status,'failed');assert.equal(f.receipts[0].result,null);assert.equal(f.receipts[0].stopConfirmed,option!=='cleanupFailure');assert(!JSON.stringify(f.receipts).includes('SECRET_'));}
});
test('false isolation, duplicate cases, missing child proof and false acceptance never count as a test success',()=>{
 const j=job();for(const mutate of [r=>r.results[0].output.checks.networkSockets=false,r=>r.results[4].output.tests[1].id=r.results[4].output.tests[0].id,r=>r.results[3].childStarted=false,r=>r.independentlyAccepted=true,r=>r.cleanupConfirmed=false]){const v=outcome(j),r=JSON.parse(v.stdout);mutate(r);v.stdout=JSON.stringify(r);assert.throws(()=>d.validateReport(j,v),/ENG_TEST_/);}
});

test('caller job mutation during claim or create cannot substitute a prepared command',async()=>{
 for(const phase of ['claim','create']){const j=job(),f=fixture(j);const original=j.manifest.commandHash;const originalMethod=f[phase==='claim'?'journal':'provider'][phase];f[phase==='claim'?'journal':'provider'][phase]=async(...args)=>{const value=await originalMethod(...args);j.command.command='/bin/sh';j.command.args=['SECRET_COMMAND'];j.manifest.commandHash='0'.repeat(64);return value;};f.provider.run=async(_id,cmd)=>{f.calls.push('run');assert.equal(cmd.command,'/usr/bin/env');assert.notEqual(cmd.args[0],'SECRET_COMMAND');const unmutated=job();assert.equal(unmutated.manifest.commandHash,original);return outcome(unmutated);};const result=await d.dispatch({job:j,...f});assert.equal(result.sourceExecuted,true);assert.equal(f.receipts[0].manifestHash,job().manifest.hash);}
});

test('cleanup never stops a foreign project or foreign unique name',async()=>{
 for(const changed of [{projectId:'prj_foreign'},{name:'callercore-test-'+ '0'.repeat(32)}]){const j=job(),f=fixture(j);const find=f.provider.find;f.provider.find=async(...args)=>({...await find(...args),...changed});await assert.rejects(d.dispatch({job:j,...f}),e=>e.message==='ENG_TEST_SHUTDOWN'&&e.cleanupConfirmed===false);assert(!f.calls.includes('stop'));assert.equal(f.receipts[0].stopConfirmed,false);}
});

test('lost create acknowledgment with absent reconciliation cannot claim cleanup',async()=>{
 const j=job(),f=fixture(j,{lostAck:true});f.provider.find=async()=>{f.calls.push('find');return null;};await assert.rejects(d.dispatch({job:j,...f}),e=>e.message==='ENG_TEST_SHUTDOWN'&&e.cleanupConfirmed===false);assert.equal(f.calls.filter(x=>x==='create').length,1);assert.equal(f.receipts[0].stopConfirmed,false);assert(!f.calls.includes('run'));assert(!f.calls.includes('stop'));
});

test('journal persistence failure returns stable code with independently observed cleanup flag',async()=>{
 for(const cleanupFailure of [false,true]){const j=job(),f=fixture(j,{cleanupFailure});f.journal.close=async()=>{throw Error('SECRET_DATABASE_FAILURE');};await assert.rejects(d.dispatch({job:j,...f}),e=>e.message==='ENG_TEST_JOURNAL_UNCONFIRMED'&&e.cleanupConfirmed===!cleanupFailure);assert(f.calls.includes('stop'));assert(f.calls.includes('read'));}
});

function assertionFailure(j){const v=outcome(j),r=JSON.parse(v.stdout);r.runPassed=false;r.results[4].exitCode=1;r.results[4].output.passed=false;r.results[4].output.tests[1].passed=false;return{exitCode:1,stdout:JSON.stringify(r)};}
test('known assertion failure completes safely as rejected review evidence and preserves historical success shape',async()=>{
 const j=job(),f=fixture(j);f.provider.run=async()=>{f.calls.push('run');return assertionFailure(j);};
 const result=await d.dispatch({job:j,...f});assert.equal(result.testsPassed,false);assert.equal(result.reviewDisposition,'behavioral-failure');assert.equal(result.tests[1].passed,false);assert.equal(result.cleanupConfirmed,true);assert.equal(result.publicationAuthorized,false);assert.equal(result.independentlyAccepted,false);assert.equal(f.receipts[0].status,'completed');assert.equal(f.receipts[0].failure,null);assert.equal(f.receipts[0].stopConfirmed,true);assert.equal(f.calls.filter(x=>x==='run').length,1);
 const historical=d.validateReport(job(),outcome(job()));assert.equal(Object.hasOwn(historical,'testsPassed'),false);assert.equal(Object.hasOwn(historical,'reviewDisposition'),false);
});
test('assertion-failure disposition cannot conceal infrastructure failure, malformed tests or inconsistent aggregate outcomes',()=>{
 const j=job();for(const mutate of [r=>r.code='SOURCE_ISOLATION_SETUP_FAILED',r=>r.phase='minimal-jail',r=>r.cleanupConfirmed=false,r=>r.protectedIntegrity=false,r=>r.qualificationPassed=false,r=>r.results[0].output.checks.networkSockets=false,r=>r.results[1].exitCode=1,r=>r.results[2].exitCode=0,r=>r.results[3].descendantsTerminated=false,r=>r.results[4].timedOut=true,r=>r.results[4].spawnFailed=true,r=>r.results[4].outputLimit=true,r=>r.results[4].exitCode=2,r=>r.results[4].output.tests.pop(),r=>r.results[4].output.tests[0].passed='false',r=>r.results[4].output.tests[1].id=r.results[4].output.tests[0].id,r=>r.results[4].output.passed=true,r=>r.runPassed=true,r=>r.results[4].output.tests.forEach(x=>x.passed=true),r=>r.publicationAuthorized=true,r=>r.independentlyAccepted=true]){const v=assertionFailure(j),r=JSON.parse(v.stdout);mutate(r);v.stdout=JSON.stringify(r);assert.throws(()=>d.validateReport(j,v),/ENG_TEST_/);}
 for(const exitCode of [0,2,null])assert.throws(()=>d.validateReport(j,{...assertionFailure(j),exitCode}),/ENG_TEST_/);
});
test('assertion failure cannot survive failed provider shutdown or lost receipt persistence',async()=>{
 for(const kind of ['shutdown','persistence']){const j=job(),f=fixture(j,{cleanupFailure:kind==='shutdown'});f.provider.run=async()=>assertionFailure(j);if(kind==='persistence')f.journal.close=async()=>{throw Error('PRIVATE_DATABASE_ERROR');};await assert.rejects(d.dispatch({job:j,...f}),new RegExp(kind==='shutdown'?'ENG_TEST_SHUTDOWN':'ENG_TEST_JOURNAL_UNCONFIRMED'));assert(f.calls.includes('stop'));}
});

async function actualSupervisor(j,options={}){return require('./helpers/notification-supervisor-fixture.cjs').fixture(options,{baseline:'UNUSED_TRUSTED_FIXTURE',patched:'UNUSED_TRUSTED_FIXTURE',runner:{command:()=>j.command},mode:'starter',testIds:d.TESTS,resultVersion:'starter-source-behavioral-result-v1'});}
test('actual trusted supervisor emits full protected hash-bound assertion failure without evaluating guest code',async()=>{
 const j=job(),f=await actualSupervisor(j,{testFailure:true}),r=d.validateReport(j,{exitCode:f.exitCode,stdout:f.output});assert.equal(f.exitCode,1);assert.equal(f.report.protectedIntegrity,true);assert.equal(f.report.cleanupConfirmed,true);assert.equal(f.report.programSha256,j.manifest.commandHash);assert.deepEqual(f.report.sourceHashes,j.manifest.sourceHashes);assert.equal(r.testsPassed,false);assert.equal(r.reviewDisposition,'behavioral-failure');assert.equal(r.tests[0].passed,false);
});
for(const [name,options]of [['qualification',{wrongChecks:true}],['cleanup',{cleanupFailure:true}],['unmount',{unmountFailure:true}],['spawn',{spawnFailure:true}],['malformed cases',{duplicateIds:true}]])test('actual trusted supervisor '+name+' cannot become reviewable assertion failure',async()=>{const j=job(),f=await actualSupervisor(j,{testFailure:true,...options});assert.throws(()=>d.validateReport(j,{exitCode:f.exitCode,stdout:f.output}),/ENG_TEST_/);});

test('immutable historical passing receipts retain exact legacy command readback while current failed receipts require reviewed version',()=>{
 const hash=require('../lib/agent-operations-engineering-tools').hash,baseline=require('../lib/agent-operations-implementation').snapshot().text,beforeText="    ['automations',d=>{automationsData=d.automations||[]}],",afterText="    ...(has('automations') ? [['automations',d=>{automationsData=d.automations||[]}]] : []),",proposal={edits:[{beforeText,afterText}]},patched=baseline.replace(beforeText,afterText),binding={ownerHash:'a'.repeat(64),workspaceHash:'b'.repeat(64),planId:'plan_1',taskId:'task',executionId:'execution',runtime:{sourceCommit:'d'.repeat(40),release:{digest:'c'.repeat(64)},deploymentId:'dpl_Test'}},testBinding={ownerHash:binding.ownerHash,workspaceHash:binding.workspaceHash,planId:binding.planId,taskId:'task_source_test',executionId:'execution_source_test',sourceCommit:binding.runtime.sourceCommit,releaseHash:binding.runtime.release.digest,deploymentId:binding.runtime.deploymentId},j=d.prepare({binding:testBinding,baseline,patched,proposalHash:hash(proposal)});
 const receipt=(manifest,result)=>{const body={version:manifest.version,manifestHash:manifest.hash,permitId:'f'.repeat(32),sessionId:'sbx_Test',status:'completed',failure:null,result,stopConfirmed:true,publicationAuthorized:false,independentlyAccepted:false};return{manifest,receipt:{...body,hash:hash(body)}};};
 const legacyCommand=require('../scripts/source-execution-isolated-runner.cjs').command({mode:'starter',baseline,patched});legacyCommand.args[legacyCommand.args.length-1]+='\n/* source-test-binding:'+hash({binding:testBinding,proposalHash:hash(proposal)})+' */\n';
 const manifest={...j.manifest,commandHash:hash(legacyCommand.args.at(-1))};delete manifest.assertionReview;delete manifest.hash;manifest.hash=hash(manifest);const legacyJob={manifest},old=receipt(manifest,d.validateReport(legacyJob,outcome(legacyJob))),snapshot=JSON.stringify(old);assert.equal(d.validateEvidence(old,binding,proposal),true);assert.equal(JSON.stringify(old),snapshot);
 const current=receipt(j.manifest,d.validateReport(j,assertionFailure(j)));assert.equal(d.validateEvidence(current,binding,proposal),true);const forged=structuredClone(old);forged.receipt.result=current.receipt.result;forged.receipt.hash=hash({...forged.receipt,hash:undefined});assert.throws(()=>d.validateEvidence(forged,binding,proposal),/ENG_TEST_FAILED/);
});
