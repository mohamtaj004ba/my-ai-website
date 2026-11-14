'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const file=path.join(__dirname,'agent-operations-engineering-review-ui.test.js'),prefix=fs.readFileSync(file,'utf8').split('\ntest(')[0],{harness,state}=new Function('require','__dirname',prefix+'\nreturn {harness,state};')(Module.createRequire(file),__dirname),d=require('../lib/agent-operations-repository-discovery'),r=require('../lib/agent-operations-repository-source'),rehearsal=require('../lib/agent-operations-engineering-rehearsal');
function setup(reply){const h=harness(reply),v=state();v.organization.templates=rehearsal.templates.map(id=>({id,name:id}));v.organization.implementationPreparation={profile:'engineering-implementation-v1',liveObjective:d.OBJECTIVE,repositoryDiscovery:{objective:d.OBJECTIVE,initialQuery:r.initial()}};h.update(v);return{h,v};}
test('Chief discovery owner view uses existing read-only API and does not create tasks or paid authority',async()=>{const {h}=setup(async b=>{a.equal(b.action,'operations-engineering-activation-repositorySource');a.deepEqual(b.input,{query:r.initial()});return{__engineering:true,value:{modelRequests:0,executionAuthorized:false}};});await h.get('opsEngineeringDevelopmentPreset').emit('click');a.equal(h.get('opsObjective').value,d.OBJECTIVE);a.equal(h.get('opsSourceTestConsent').checked,false);await h.get('opsRepositoryInspect').emit('click');a.equal(h.calls.length,1);a.match(h.get('opsRepositoryResult').textContent,/modelRequests/);});
test('invalid repository query is rejected before task or durable mutation',async()=>{const {h}=setup(async()=>{throw Error('No request allowed');});await h.get('opsEngineeringDevelopmentPreset').emit('click');h.get('opsRepositoryQuery').value='{';await h.submit();a.equal(h.calls.length,0);a.equal(h.storage.has('callercore-internal-assignment-pending-v1'),false);});
for(const change of ['workspace','deployment','logout'])test('repository evidence clears on '+change+' and controls recover after authentication',async()=>{const {h,v}=setup(async()=>({__engineering:true,value:{evidence:'FICTIONAL_PREVIOUS_OWNER_SOURCE'}}));await h.get('opsRepositoryInspect').emit('click');a.match(h.get('opsRepositoryResult').textContent,/FICTIONAL/);const next=structuredClone(v);next.revision++;if(change==='workspace')next.scopeIdentity.workspaceHash='e'.repeat(64);else next.runtime.deploymentId='dpl_new';h.update(change==='logout'?null:next);a.doesNotMatch(h.get('opsRepositoryResult').textContent,/FICTIONAL/);a.equal(h.get('opsRepositoryQuery').value,'');h.update(next);a.equal(h.get('opsRepositoryInspect').disabled,false);a.equal(h.get('opsRepositoryQuery').disabled,false);});
test('late source response cannot populate a changed owner and leaves current controls usable',async()=>{let finish;const response=new Promise(resolve=>finish=resolve),{h,v}=setup(async()=>response),click=h.get('opsRepositoryInspect').emit('click');await new Promise(setImmediate);const next=structuredClone(v);next.revision++;next.scopeIdentity.workspaceHash='f'.repeat(64);h.update(next);finish({__engineering:true,value:{evidence:'FICTIONAL_LATE_SOURCE'}});await click;a.doesNotMatch(h.get('opsRepositoryResult').textContent,/FICTIONAL_LATE/);a.equal(h.get('opsRepositoryInspect').disabled,false);a.equal(h.get('opsRepositoryQuery').disabled,false);});

for(const late of [false,true])test('Chief inspection fetches source without another model run and fences late results: '+late,async()=>{
 const {h,v}=setup(async b=>{
  const action=b.action;
  if(action.endsWith('-activate'))return {__engineering:true,value:{revision:2}};
  if(action.endsWith('-run'))return {__engineering:true,value:{result:{mode:'live-read-only-discovery',artifact:{decision:{decision:'inspect',inspection:{...r.initial(),kind:'read-file',path:'api/create-checkout-session.js'}}}}}};
  if(action.endsWith('-repositorySource')){
   a.equal(b.input.query.kind,'read-file');
   if(late){const updated=structuredClone(v);updated.revision++;updated.scopeIdentity.workspaceHash='f'.repeat(64);h.update(updated);}
   return {__engineering:true,value:{packet:{marker:'CHECKOUT_SOURCE'},modelRequests:0}};
  }
  a.ok(action.endsWith('-revoke'));
  return {__engineering:true,value:{status:'revoked'}};
 });
 h.storage.set('callercore-engineering-trial-once-v1',JSON.stringify({scope:v.scopeIdentity,input:{planId:'op_trial_ui',approval:{sourceCommit:v.runtime.sourceCommit,contractHash:v.runtime.release.digest,deploymentOrigin:v.runtime.origin,id:'pilot_ui',workflowId:'wf_ui'}},expectedApprovalRevision:1,requested:false}));
 await h.get('opsEngineeringTrialRun').emit('click');
 a.equal(h.calls.filter(c=>c.action.endsWith('-run')).length,1);
 a.equal(h.calls.filter(c=>c.action.endsWith('-repositorySource')).length,1);
 a.ok(h.calls.findIndex(c=>c.action.endsWith('-revoke'))<h.calls.findIndex(c=>c.action.endsWith('-repositorySource')));
 if(late)a.doesNotMatch(h.get('opsRepositoryResult').textContent,/CHECKOUT_SOURCE/);
 else a.match(h.get('opsRepositoryResult').textContent,/CHECKOUT_SOURCE/);
});
