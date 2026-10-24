'use strict';
require('./helpers/historical-starter-fixture.cjs'); // Explicit pre-fix offline task replay.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const fixtureFile=path.join(__dirname,'agent-operations-engineering-review-ui.test.js'),prefix=fs.readFileSync(fixtureFile,'utf8').split('\ntest(')[0];
const {harness,state}=new Function('require','__dirname',prefix+'\nreturn {harness,state};')(Module.createRequire(fixtureFile),__dirname);
const impl=require('../lib/agent-operations-implementation'),helper=require('../lib/agent-operations-engineering-rehearsal');
const draftKey='callercore-internal-assignment-pending-v1',seqKey='callercore-engineering-development-4usd-v1',configKey='callercore-engineering-configuration-intent-v1';
function setup(reply,storage=new Map()){
 const h=harness(reply,storage),v=state();v.runtime={origin:'https://my-ai-website-test-mohamtaj004bas-projects.vercel.app',sourceCommit:'c'.repeat(40),branch:'feature/callercore-dashboards',deploymentId:'dpl_test',release:{version:'organization-contracts-v4',digest:'d'.repeat(64)}};
 v.organization.implementationPreparation={profile:impl.PROFILE,objective:impl.OBJECTIVE};v.organization.templates=helper.templates.map(id=>({id,name:id,department:'engineering'}));
 const seq={id:'sequence_'+'1'.repeat(32),scope:v.scopeIdentity,runtime:JSON.stringify(v.runtime)},config={id:'refresh_'+'2'.repeat(32),status:'verified',identity:v.scopeIdentity,sequenceIntentId:seq.id};
 storage.set(seqKey,JSON.stringify(seq));storage.set(configKey,JSON.stringify(config));h.update(v);
 return {h,v,storage,config,seq,select:()=>h.get('opsEngineeringDevelopmentPreset').emit('click'),click:()=>h.get('opsEngineeringFreshExecution').emit('click')};
}
test('fresh execution uses a new idempotent ten-minute task after preparation, with no approval or model call',async()=>{
 let f,created;f=setup(async b=>{if(b.action==='operations-create'){assert.deepEqual(JSON.parse(f.storage.get(draftKey)).input,b.input);created=require('../lib/agent-operations-operating-system').makePlan(b.input,f.v.runtime,Date.now());return created;}if(b.action==='operations-read'){return {...f.v,revision:2,at:f.v.at+1,plans:[created]};}throw Error('Unexpected operation');});
 await f.select();await f.click();assert.equal(f.h.calls.length,2);assert.equal(created.deadline-created.createdAt,600000);assert.equal(created.engineeringProfile,impl.PROFILE);assert.equal(created.tasks.length,5);assert.equal(f.storage.has(draftKey),false);assert.match(f.h.get('opsEngineeringTrialResult').textContent,/No paid request or approval/);assert.equal(f.h.get('opsEngineeringTrialPrepare').disabled,false);assert.equal(f.h.get('opsEngineeringFreshExecution').disabled,false);
 await f.click();assert.equal(f.h.calls.length,2,'A queued live task prevents duplicate creation');
});
for(const fault of ['configuration','workspace','runtime','open-preparation','saved-approval','wrong-profile'])test('fresh execution denies '+fault+' before any mutation',async()=>{
 const f=setup(async()=>{throw Error('No request allowed');});
 if(fault==='configuration')f.storage.set(configKey,JSON.stringify({...f.config,status:'claimed'}));
 if(fault==='workspace')f.storage.set(configKey,JSON.stringify({...f.config,identity:{...f.v.scopeIdentity,workspaceHash:'f'.repeat(64)}}));
 if(fault==='runtime')f.storage.set(seqKey,JSON.stringify({...f.seq,runtime:'old-runtime'}));
 if(fault==='open-preparation'){f.v.plans=[{id:'op_preparation',status:'queued',engineeringProfile:impl.PROFILE,tasks:[]}];f.h.update(f.v);}
 if(fault==='saved-approval')f.storage.set('callercore-engineering-development-attempt-v1',JSON.stringify({input:{approval:{}}}));
 if(fault==='wrong-profile')f.v.organization.implementationPreparation.profile='foreign';
 await f.select();await f.click();assert.equal(f.h.calls.length,0);assert.equal(f.storage.has(draftKey),false);
});
test('lost creation acknowledgement retains the original draft across restart and does not retry',async()=>{
 const f=setup(async()=>{throw Error('PRIVATE_NETWORK_ERROR');});await f.select();await f.click();const saved=f.storage.get(draftKey);assert(saved);await f.click();assert.equal(f.h.calls.length,1);
 const restored=setup(async()=>{throw Error('No retry allowed');},f.storage);await restored.select();await restored.click();assert.equal(restored.h.calls.length,0);assert.equal(restored.storage.get(draftKey),saved);assert.doesNotMatch(f.h.get('opsEngineeringTrialResult').textContent,/PRIVATE_NETWORK_ERROR/);
});
test('late cross-workspace acknowledgement cannot prepare or expose a fresh task',async()=>{
 let finish;const f=setup(()=>new Promise(r=>finish=r));await f.select();const waiting=f.click();await new Promise(setImmediate);f.h.update({...f.v,revision:2,scopeIdentity:{...f.v.scopeIdentity,workspaceHash:'f'.repeat(64)}});finish({id:'PRIVATE_FOREIGN_TASK'});await waiting;
 assert.equal(f.h.calls.length,1);assert.doesNotMatch(f.h.get('opsEngineeringTrialResult').textContent,/PRIVATE_FOREIGN_TASK/);assert(f.storage.has(draftKey));
});
test('repeated clicks during an in-flight creation send only one request',async()=>{
 let finish;const f=setup(b=>b.action==='operations-create'?new Promise(r=>finish=r):Promise.reject(Error('Readback unavailable')));await f.select();const waiting=f.click();await new Promise(setImmediate);await f.click();assert.equal(f.h.calls.length,1);finish({});await waiting;assert.equal(f.h.calls.filter(c=>c.action==='operations-create').length,1);assert(f.storage.has(draftKey));assert.equal(f.h.get('opsEngineeringTrialPrepare').disabled,false);
});
test('failed durable draft write cannot dispatch creation or create authority',async()=>{
 const storage=new Map(),f=setup(async()=>{throw Error('No request allowed');},storage),set=storage.set.bind(storage);storage.set=(k,v)=>{if(k===draftKey)throw Error('PRIVATE_STORAGE_ERROR');return set(k,v);};await f.select();await f.click();assert.equal(f.h.calls.length,0);assert.doesNotMatch(f.h.get('opsEngineeringTrialResult').textContent,/PRIVATE_STORAGE_ERROR/);assert.equal(f.h.get('opsEngineeringFreshExecution').disabled,false);
});
