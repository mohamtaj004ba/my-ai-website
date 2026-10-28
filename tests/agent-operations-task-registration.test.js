'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const tasks=require('../lib/agent-operations-implementation-tasks'),impl=require('../lib/agent-operations-implementation'),provider=require('../lib/agent-operations-engineering-provider-v2'),dispatch=require('../lib/agent-operations-source-test-dispatch');
const baseline=require('./fixtures/engineering-task-registration-before.json');
const hash=x=>require('node:crypto').createHash('sha256').update(JSON.stringify(x)).digest('hex');
for(const [index,row] of baseline.rows.entries())test('registration preserves independently captured pre-refactor route '+index,()=>{
 const c={assignment:row.assignment},registration=tasks.registration(c);
 a.equal(impl.enabled(c),row.enabled);a.equal(!!registration,row.enabled);
 a.equal(hash(tasks.descriptor(c)),row.descriptorHash);
 a.equal(hash(provider.developmentFor(c)),row.policyHash);
 a.equal(hash(dispatch.profileFor(c)),row.testProfileHash);
 if(registration){
  a.equal(registration.executionAuthorized,false);a.equal(registration.publicationAuthorized,false);
  a.deepEqual(registration.descriptor,impl.taskFor(c));
  a.equal(tasks.admits(c),row.assignment===impl.OBJECTIVE||!!registration.descriptor);
  if(registration.sourceTest)a.equal(registration.sourceTest.version,dispatch.profileFor(c).version);
 }
});
test('all serialized historical policies and public capabilities remain unchanged',()=>{
 a.equal(hash(Object.fromEntries(Object.entries(provider).filter(([k])=>k.endsWith('TRIAL')))),baseline.trialsHash);
 a.equal(hash(impl.capabilities()),baseline.capabilitiesHash);
});
test('every development policy is selected through the catalog and participates in serial protection',()=>{
 const entries=tasks.developmentRegistrations(),ids=tasks.serialPolicyIds();
 a.equal(new Set(entries.map(x=>x.objective)).size,entries.length);
 a.equal(new Set(ids).size,ids.length);
 a(ids.includes('owner-starter-disposable-patch-once-v1'));
 for(const r of entries){a.equal(provider[r.key].objective,r.objective);a.equal(provider[r.key].authorizationId,r.authorizationId);a.equal(provider.developmentFor({assignment:r.objective}),provider[r.key]);a(ids.includes(r.authorizationId));}
});
test('forged objectives and caller-supplied registry fields cannot create a task or test capability',()=>{
 for(const assignment of ['',null,{},'constructor','__proto__',impl.OBJECTIVE+' ',impl.OBJECTIVE.replace('Starter','Other')]){
  const c={assignment,id:'client-phone-search-v1',development:{key:'PHONE_SEARCH_TRIAL'},sourceTest:tasks.SOURCE_TESTS.phone,descriptor:{testProfile:dispatch.PHONE_PROFILE}};
  a.equal(tasks.registration(c),null);a.equal(tasks.admits(c),false);a.equal(provider.developmentFor(c),null);a.equal(dispatch.profileFor(c),null);
 }
 a.equal(tasks.testProfileByVersion('arbitrary-shell'),null);
 a.throws(()=>tasks.developmentRegistration('constructor'),/ENG_TASK_SCOPE/);
});
test('returned registration and policy copies cannot change trusted catalog state',()=>{
 const c={assignment:provider.PHONE_SEARCH_TRIAL.objective},before=tasks.registration(c),copy=tasks.registration(c);
 copy.descriptor.files[0].path='api/account.js';copy.sourceTest.mode='shell';copy.development.objective='forged';
 const policies=tasks.developmentRegistrations();policies[0].objective='forged';
 a.deepEqual(tasks.registration(c),before);
 a.equal(provider.developmentFor(c),provider.PHONE_SEARCH_TRIAL);
 const testProfile=tasks.testProfileFor(c);testProfile.tests[0]='forged';a.notEqual(tasks.testProfileFor(c).tests[0],'forged');
});
test('historical Starter routes replay but cannot become fresh admission',()=>{
 for(const [key,assignment] of Object.entries(tasks.STARTER).filter(([k])=>k.endsWith('OBJECTIVE'))){
  const c={assignment};a.equal(impl.enabled(c),true);a.equal(tasks.admits(c),key==='OBJECTIVE');a.equal(dispatch.profileFor(c).version,dispatch.PROFILE);
 }
 const notification=tasks.list().find(x=>x.id==='notifications-refresh-controls-v1');
 a.equal(tasks.admits({assignment:notification.objective}),true);
 a.equal(provider.developmentFor({assignment:notification.objective}),null);
 a.equal(dispatch.profileFor({assignment:notification.objective}),null);
});
test('policy selection does not read or inflate source evidence',()=>{
 const phone=require('../lib/agent-operations-phone-search'),original=phone.descriptor;
 phone.descriptor=()=>{throw Error('unexpected source descriptor read');};
 try{a.equal(provider.developmentFor({assignment:phone.OBJECTIVE}),provider.PHONE_SEARCH_TRIAL);}finally{phone.descriptor=original;}
});
