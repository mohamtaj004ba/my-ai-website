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
