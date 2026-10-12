'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const node=require('../lib/agent-operations-node-controller'),life=require('../lib/agent-operations-approval-lifecycle');
const digest=v=>crypto.createHash('sha256').update(v).digest('hex');
function fixture(){
 const owner={kind:'owner',verifiedOwner:true,id:'auditor@example.test'},runtime={origin:'https://auditor-preview.vercel.app',commit:'a'.repeat(40)},release={version:'auditor-v1',digest:'b'.repeat(64)};
 const approval={id:'pilot_auditor_controller',workflowId:'wf_'+'c'.repeat(32),sourceCommit:runtime.commit,lifecycleVersion:life.VERSION,ownerHash:digest(owner.id),contractVersion:release.version,contractHash:release.digest,purpose:'nonbillable-lifecycle-verification-v1',scopeHash:'d'.repeat(64),authorized:false,maxCalls:0,maxMicros:0,expiresAt:Date.now()+60000};
 const ledger={approvals:[],workflows:[],grants:[]};let prepares=0,initializes=0;
 const snapshot=async()=>({runtime,release,record:life.find(ledger,approval)?life.publicRecord(life.find(ledger,approval)):undefined,paidExecution:false,maxCalls:0,maxMicros:0,controlAuthority:life.verified(ledger,approval,runtime,Date.now(),{initializing:true})||life.verified(ledger,approval,runtime,Date.now())});
 const port={prepare:async()=>{prepares++;life.prepare(ledger,approval,owner,Date.now());return snapshot();},activate:async({expectedRevision})=>{life.activate(ledger,approval,owner,runtime,Date.now(),expectedRevision);return snapshot();},renew:async()=>{life.control(ledger,approval.id,owner,Date.now(),{type:'renew'});return snapshot();},initialize:async()=>{initializes++;life.consume(ledger,approval,runtime,Date.now());return{created:{id:approval.workflowId,inert:true},receipt:await snapshot()};},revoke:async()=>{life.control(ledger,approval.id,owner,Date.now(),{type:'revoke'});return snapshot();},snapshot};
 return{owner,runtime,release,approval,ledger,port,binding:{approval,runtime,release},counts:()=>({prepares,initializes})};
}
test('Auditor Node: forged receipt identity stops before initialization and revokes exact record',async()=>{
 for(const field of ['runtime','approval','limits']){
  const f=fixture(),original=f.port.activate;f.port.activate=async input=>{const r=await original(input);if(field==='runtime')r.runtime={...r.runtime,commit:'e'.repeat(40)};if(field==='approval')r.record.workflowId='wf_'+'f'.repeat(32);if(field==='limits')r.maxCalls=1;return r;};
  await assert.rejects(node.execute({...f,run:async()=>assert.fail('run must not start')}),/stopped/);
  assert.equal(f.counts().initializes,0);assert.equal(life.find(f.ledger,f.approval).status,'revoked');
 }
});
test('Auditor Node: lost initialization response preserves consumed history and shuts down without running',async()=>{
 const f=fixture(),initialize=f.port.initialize;f.port.initialize=async input=>{await initialize(input);throw Error('lost response');};
 await assert.rejects(node.execute({...f,run:async()=>assert.fail('no unconfirmed task execution')}),/stopped/);
 const r=life.find(f.ledger,f.approval);assert.equal(r.status,'revoked');assert(r.events.some(e=>e.type==='initialized'));assert.equal(f.counts().initializes,1);
});
test('Auditor Node: nonresponsive renewal aborts once with no queued renewals and central cleanup',async()=>{
 const f=fixture();let renewals=0,aborted=false;f.port.renew=()=>{renewals++;return new Promise(()=>{});};
 await assert.rejects(node.execute({...f,renewMs:2,renewTimeoutMs:8,durationMs:500,run:(_,{signal})=>new Promise(()=>signal.addEventListener('abort',()=>aborted=true,{once:true}))}),/stopped/);
 assert.equal(renewals,1);assert(aborted);assert.equal(life.find(f.ledger,f.approval).status,'revoked');
});
test('Auditor Node: shutdown contradiction cannot produce completion or replacement proof',async()=>{
 const f=fixture(),snapshot=f.port.snapshot;f.port.snapshot=async()=>{const r=await snapshot();if(r.record?.status==='revoked')r.controlAuthority=true;return r;};
 let caught;try{await node.execute({...f,run:async()=>({inert:true})});assert.fail('contradiction accepted');}catch(e){caught=e;}
 assert.equal(caught.message,'Node controller shutdown unconfirmed');assert.equal(caught.controllerEvidence.completed,false);assert.equal(caught.controllerEvidence.requiresIndependentReplacementReadback,true);
});
test('Auditor Node: revoked owner permission blocks operational ports but never blocks cleanup revoke',async()=>{
 const f=fixture();let allowed=true,revokes=0,prepares=0;
 const organization={prepareApproval:async()=>prepares++,controlApproval:async(_owner,input)=>{assert.equal(input.type,'revoke');revokes++;},summary:async()=>({approvals:[{id:f.approval.id}],workflows:[],paidExecution:false})};
 const port=node.organizationPort({...f,organization,authorize:async()=>allowed});allowed=false;
 await assert.rejects(port.prepare({}),/permission revoked/);await assert.rejects(port.snapshot({}),/permission revoked/);assert.equal(prepares,0);await port.revoke({});assert.equal(revokes,1);
});
test('Auditor Node: automatic revocation cannot disguise absent, foreign or altered terminal results',async()=>{
 for(const mutation of ['absent','foreign','revision','outcomes','results','incomplete']){
  const f=fixture();Object.assign(f.approval,{authorized:true,maxCalls:5,maxMicros:3600000});
  let terminal;const snapshot=f.port.snapshot;f.port.snapshot=async()=>({...await snapshot(),workflow:terminal});
  await assert.rejects(node.execute({...f,run:async()=>{
   terminal={id:f.approval.workflowId,approvalId:f.approval.id,revision:9,stage:'outcome',status:'verified',outcomes:{execution:'completed',structural:'passed',integrity:'passed',acceptedWork:true},results:{chief:{note:'original'}}};
   const result=structuredClone(terminal);life.retire(f.ledger,f.approval.id,Date.now());
   if(mutation==='absent')terminal=undefined;
   if(mutation==='foreign')terminal.approvalId='pilot_foreign_authority';
   if(mutation==='revision')result.revision++;
   if(mutation==='outcomes')result.outcomes.acceptedWork=false;
   if(mutation==='results')result.results.chief.note='altered';
   if(mutation==='incomplete')terminal.outcomes.execution='failed';
   return result;
  }}),/stopped/);
  assert.equal(life.find(f.ledger,f.approval).status,'revoked');
 }
});
test('Auditor remote: initialization lost after dispatch is never automatically repeated',async()=>{
 const f=fixture();let initializes=0,calls=0;const approval=f.approval,hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
 const remote=require('../lib/agent-operations-remote-worker').createRemote({runtime:f.runtime,approval,headers:{Authorization:'Bearer test-only'},fetchImpl:async(_url,options)=>{
  calls++;assert.equal(options.redirect,'error');if(options.body){initializes++;assert.equal(JSON.parse(options.body).action,'organization-initialize');throw Error('Response lost after synthetic commit');}
  return{ok:true,json:async()=>({runtime:f.runtime,paidExecution:true,organization:{paidExecution:true,contractPreflight:f.release,approvals:[{id:approval.id,status:'active',workflowId:approval.workflowId,approvalHash:hash(approval)}]}})};
 }});
 await assert.rejects(remote.initializeOnce(),/Response lost/);await assert.rejects(remote.initializeOnce(),/already attempted/);assert.equal(initializes,1);assert.equal(calls,2);
});
test('Auditor remote: cancellation bypass exists only for bound diagnostic receipts',async()=>{
 const f=fixture(),controller=new AbortController(),requests=[];
 const remote=require('../lib/agent-operations-remote-worker').createRemote({runtime:f.runtime,approval:f.approval,headers:{Authorization:'Bearer test-only'},signal:controller.signal,fetchImpl:async(_url,options)=>{requests.push(JSON.parse(options.body));assert(!options.signal.aborted);return{ok:true,json:async()=>({organization:{recorded:true}})};}});
 controller.abort();const actor={workflowId:f.approval.workflowId,token:'test-only'};
 await assert.rejects(remote.organization.command(actor,actor.workflowId,{type:'dispatch'}),/cancelled/);assert.equal(requests.length,0);
 await remote.organization.recordDiagnostic(actor,actor.workflowId,{executionId:'exec_test',diagnostic:{clientRequestId:'exec_test'}});assert.equal(requests.length,1);assert.equal(requests[0].action,'organization-diagnostic');
 await assert.rejects(remote.organization.recordDiagnostic({...actor,workflowId:'wf_foreign'},'wf_foreign',{}),/Foreign/);assert.equal(requests.length,1);
});
test('Auditor release: only Vercel JSON formatting is immaterial; deployment values remain bound',()=>{
 const fs=require('node:fs'),path=require('node:path'),contracts=require('../lib/agent-operations-contracts'),target=require.resolve('../vercel.json'),read=fs.readFileSync,base=contracts.release(),raw=read(target,'utf8'),config=JSON.parse(raw);
 const mutate=text=>{fs.readFileSync=function(file,...args){return path.resolve(String(file))===target?text:read.call(this,file,...args);};};
 try{
  mutate(JSON.stringify(config));assert.deepEqual(contracts.release(),base);
  mutate(JSON.stringify(config,null,4));assert.deepEqual(contracts.release(),base);
  for(const variant of ['duration','unknown','type']){
   const changed=structuredClone(config);if(variant==='duration')changed.functions['api/agent-operations.js'].maxDuration=659;
   if(variant==='unknown')changed.auditUnknown={mustRemainBound:true};
   if(variant==='type')changed.functions['api/agent-operations.js'].maxDuration='660';
   mutate(JSON.stringify(changed));assert.notEqual(contracts.release().digest,base.digest,variant);
  }
  mutate('{invalid');assert.throws(()=>contracts.release(),SyntaxError);
 }finally{fs.readFileSync=read;}
 assert.deepEqual(contracts.release(),base);
});
