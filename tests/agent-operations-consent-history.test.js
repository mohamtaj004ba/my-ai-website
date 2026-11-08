'use strict';
const test=require('node:test'),a=require('node:assert/strict'),helper=require('./helpers/engineering-controller.cjs'),cfg=require('../lib/agent-operations-engineering-configuration');
test('rehashed legacy metadata cannot carry nested private content into owner history',async()=>{
 const f=await helper.fixture({objective:require('../lib/agent-operations-phone-search').OBJECTIVE}),s=f.state(),base=s.operations.engineeringConfigurationIntents[0],p=require('../lib/agent-operations-engineering-provider-v2');
 const keys=['id','identity','sequenceIntentId','scope','sourceCommit','release','assignmentHash','evidenceHash','policyHash','review','values','refreshKey','taskId','originalRuntime','configurationHash','createdAt','expiresAt'];
 for(const field of ['taskId','id','sequenceIntentId','sourceCommit','release','createdAt']){
  const r=structuredClone(base);r.status='claimed';r[field]={privateMarker:'NESTED_METADATA_SHOULD_NOT_RENDER'};if(field==='createdAt')r.expiresAt=r.createdAt+86400000;
  const body=Object.fromEntries(keys.map(k=>[k,r[k]]));if(r.configurationLease)body.configurationLease=r.configurationLease;if(r.recovery)body.recovery=r.recovery;r.intentHash=p.hash(body);
  const o={engineeringConfigurationIntents:[r]},before=JSON.stringify(o),view=cfg.ownerReadback(o,helper.owner);
  a.equal(view.records.length,0,field);a.equal(view.unverifiedOwnedCount,1,field);a(!JSON.stringify(view).includes('NESTED_METADATA'));a.equal(JSON.stringify(o),before);
 }
});
test('owner history discovers legacy and reviewed receipts without adopting authority or exposing private configuration',async()=>{
 const f=await helper.fixture({objective:require('../lib/agent-operations-phone-search').OBJECTIVE}),s=f.state(),legacy=s.operations.engineeringConfigurationIntents[0],input={id:'refresh_'+'6'.repeat(32),sequenceIntentId:'sequence_'+'5'.repeat(32),review:legacy.review};cfg.consentClaim(s.operations,f.context,input,Date.now());
 const reviewed=s.operations.engineeringConfigurationIntents.at(-1),foreign=structuredClone(reviewed);foreign.identity.workspaceHash='f'.repeat(64);foreign.id='PRIVATE_FOREIGN_ID';s.operations.engineeringConfigurationIntents.push(foreign);const bad=structuredClone(reviewed);bad.completionHash='0'.repeat(64);s.operations.engineeringConfigurationIntents.push(bad);
 const before=JSON.stringify(s),view=cfg.ownerReadback(s.operations,helper.owner);a.equal(view.records.length,2);a.equal(view.unverifiedOwnedCount,1);a.equal(view.executionAuthorized,false);a.equal(JSON.stringify(s),before);a(view.records.every(r=>r.executionAuthorized===false));a.doesNotMatch(JSON.stringify(view),/PRIVATE_FOREIGN_ID|policyPins|values|taskBinding|workQaHash/);a.equal(view.records[1].id,input.id);a.equal(view.records[1].taskId,f.plan.id);a.equal(view.records[1].sequenceIntentId,input.sequenceIntentId);
 cfg.consentRevoke(s.operations,f.context,input.id,Date.now());a.equal(cfg.ownerReadback(s.operations,helper.owner).records[1].status,'revoked');a.equal(cfg.ownerReadback(s.operations,{...helper.owner,id:'foreign'}).records.length,0);a.equal(cfg.ownerReadback(s.operations,{...helper.owner,kind:'service'}).records.length,0);
 const damagedLegacy=structuredClone(legacy);damagedLegacy.completionHash='0'.repeat(64);s.operations.engineeringConfigurationIntents.push(damagedLegacy);a.equal(cfg.ownerReadback(s.operations,helper.owner).records.length,2);a.equal(cfg.ownerReadback(s.operations,helper.owner).unverifiedOwnedCount,2);
 f.set(s);const control=await f.organization.ownerPilotControl(helper.owner);a.deepEqual(control.engineeringConfigurationHistory,cfg.ownerReadback(s.operations,helper.owner));a.equal(control.paidExecution,false);
});
