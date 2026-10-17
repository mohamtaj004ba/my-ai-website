'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createOrganization,PROFILE,POLICY,hash}=require('../lib/agent-operations-organization');
const {createStore}=require('../lib/agent-operations-store'),contracts=require('../lib/agent-operations-contracts'),{PROJECT}=require('../lib/agent-operations-project');
const scope={origin:'https://my-ai-website-lh7loz3s5-mohamtaj004bas-projects.vercel.app',commit:'8133597ff2fc5b48e3de42336e9e06fa4191c2a8',paths:['/industries/legal','/#pricing']};
const owner={kind:'owner',id:'auditor-owner@example.test',verifiedOwner:true};
function fixture(){
 let raw=null;const now=Date.now(),release=contracts.release(),approval={id:'pilot_auditor_offline',sourceCommit:'a'.repeat(40),lifecycleVersion:'durable-approval-v1',workflowId:'wf_'+'8'.repeat(32),ownerHash:crypto.createHash('sha256').update(owner.id).digest('hex'),authorized:true,contractVersion:release.version,contractHash:release.digest,profile:PROFILE,policyVersion:POLICY,...PROJECT,scopeHash:hash(scope),expiresAt:now+600000,maxCalls:5,maxMicros:3600000,models:{chief:'gpt-6.1-sol',specialist:'gpt-6.1-sol',qa:'gpt-6.1-sol'},reasoning:'medium',visionEstimateAccepted:true,pricingVersion:'2026-10-11-sol61-standard-no-cache',schemaVersion:'hybrid-grounding-v2',chiefContractVersion:'chief-intent-v2'};
 const adapter={read:async()=>raw,compare:async(old,next)=>{if(old!==raw)return false;raw=next;return true;}};
 const instance=a=>createOrganization(adapter,{scope,clock:()=>now,liveApproval:()=>a,runtime:{origin:'https://auditor-preview.vercel.app',commit:'a'.repeat(40)},paidEnabled:()=>true});
 return {adapter,approval,org:instance(approval),instance};
}
test('Auditor: shared legacy writer preserves lifecycle revocation capacity',async()=>{
 const f=fixture();await f.org.prepareApproval(owner);await f.org.activateApproval(owner,{id:f.approval.id,expectedRevision:1});
 const before=await f.adapter.read(),s=JSON.parse(before);s.auditorCapacityPadding='';s.auditorCapacityPadding='x'.repeat(989950-Buffer.byteLength(JSON.stringify(s)));await f.adapter.compare(before,JSON.stringify(s));
 const padded=await f.adapter.read(),store=createStore(f.adapter,{scope,clock:Date.now});
 await assert.rejects(store.create({principal:'auditor@example.test',idempotencyKey:'auditor_capacity_command',objective:'Read-only capacity regression',mode:'mock'}),/capacity/i);
 assert.equal(await f.adapter.read(),padded,'Rejected legacy command must not commit over reserved headroom');
 await f.org.controlApproval(owner,{id:f.approval.id,type:'revoke'});assert.equal((await f.org.summary()).paidExecution,false);assert.equal((await f.org.read()).operations.approvals[0].status,'revoked');
 assert.equal((await f.org.summary()).budget.retainedMicros,0);
});
test('Auditor: distinct approvals cannot reuse reserved or historical workflow identity',async()=>{
 const f=fixture();await f.org.prepareApproval(owner);
 await assert.rejects(f.instance({...f.approval,id:'pilot_auditor_second'}).prepareApproval(owner),/Task id already used/);
 await f.org.controlApproval(owner,{id:f.approval.id,type:'revoke'});
 await assert.rejects(f.instance({...f.approval,id:'pilot_auditor_third'}).prepareApproval(owner),/Task id already used/);
 const other={...f.approval,id:'pilot_auditor_fourth',workflowId:'wf_'+'9'.repeat(32)},raw=await f.adapter.read(),s=JSON.parse(raw);s.operations.workflows.push({id:other.workflowId,mode:'mock',status:'cancelled'});await f.adapter.compare(raw,JSON.stringify(s));
 await assert.rejects(f.instance(other).prepareApproval(owner),/Task id already used/);
});
test('Auditor: bounded preexisting one-megabyte legacy ledger still permits revocation',async()=>{
 const f=fixture();await f.org.prepareApproval(owner);await f.org.activateApproval(owner,{id:f.approval.id,expectedRevision:1});
 const raw=await f.adapter.read(),s=JSON.parse(raw);s.auditorLegacyPadding='';s.auditorLegacyPadding='x'.repeat(1000000-Buffer.byteLength(JSON.stringify(s)));await f.adapter.compare(raw,JSON.stringify(s));
 assert.equal(Buffer.byteLength(await f.adapter.read()),1000000);
 await f.org.controlApproval(owner,{id:f.approval.id,type:'revoke'});assert.equal((await f.org.summary()).paidExecution,false);
 assert.equal((await f.org.read()).operations.approvals[0].status,'revoked');assert(Buffer.byteLength(await f.adapter.read())<=1010000);
});
test('Auditor: HTTP worker cannot prepare/activate/renew and non-owner cannot control approvals',async()=>{
 const {createHandler}=require('../lib/agent-operations-api');let controlled=0;
 const env={VERCEL_ENV:'preview',CALLERCORE_AGENTOPS_ENABLED:'true',CALLERCORE_AGENTOPS_PAID_ENABLED:'false',CALLERCORE_AGENTOPS_WORKER_SECRET:'w'.repeat(32)};
 const organization={controlApproval:async(actor,input)=>{controlled++;assert.equal(actor,null);assert.equal(input.type,'revoke');assert.equal(input.token,'t'.repeat(64));return {status:'revoked'};}};
 const handler=createHandler({env,store:{scope,read:async()=>({tasks:[],reservations:[]})},organization,getSession:async()=>({email:'admin@example.test',workspaceId:'test'}),getMember:async()=>({email:'admin@example.test',workspaceId:'test',role:'admin'}),getWorkspace:async()=>({ownerEmail:'other@example.test'}),rateLimit:async()=>({limited:false})});
 async function request(action,worker,input={id:'pilot_auditor_offline',token:'t'.repeat(64),type:'renew'}){let code,payload;const res={setHeader(){},status(n){code=n;return this;},json(v){payload=v;return this;}};await handler({method:'POST',headers:{authorization:worker?'Bearer '+env.CALLERCORE_AGENTOPS_WORKER_SECRET:'',origin:'https://auditor-preview.vercel.app',host:'auditor-preview.vercel.app'},query:{},body:{action,input}},res);return {code,payload};}
 for(const action of ['organization-approval-prepare','organization-approval-activate','organization-approval-control'])assert.equal((await request(action,true)).code,403);
 for(const action of ['organization-approval-prepare','organization-approval-activate','organization-approval-control'])assert.equal((await request(action,false)).code,403);
 assert.equal(controlled,0);assert.equal((await request('organization-approval-revoke',true)).code,200);assert.equal(controlled,1,'Dedicated route forces revoke even if supplied input says renew');
});
