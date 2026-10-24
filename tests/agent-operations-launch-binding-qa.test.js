'use strict';
// Independently authored actual-launch regressions. No real credential, browser,
// provider transport, Redis infrastructure or owner session is used.
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),crypto=require('node:crypto');
const {createOrganization,PROFILE,POLICY,hash}=require('../lib/agent-operations-organization');
const {PROJECT}=require('../lib/agent-operations-project');
const launch=require('../scripts/agent-operations-organizational-launch.cjs');
const scope={origin:'https://my-ai-website-lh7loz3s5-mohamtaj004bas-projects.vercel.app',commit:'8133597ff2fc5b48e3de42336e9e06fa4191c2a8',paths:['/industries/legal','/#pricing']};
async function fixture(patch,{approvalOrigin}={}){
 let raw=null,reads=0,revokes=0,providerCalls=0;
 const runtime={origin:'https://launcher-binding-review.vercel.app',commit:'a'.repeat(40)},owner={kind:'owner',verifiedOwner:true,id:'launcher-qa@example.test'},secret='synthetic-worker-secret-not-a-real-credential';
 const release=require('../lib/agent-operations-contracts').assertRelease();
 const approval={id:'pilot_launcher_binding_qa',lifecycleVersion:'durable-approval-v1',sourceCommit:runtime.commit,workflowId:'wf_'+'1'.repeat(32),ownerHash:crypto.createHash('sha256').update(owner.id).digest('hex'),authorized:true,contractVersion:release.version,contractHash:release.digest,profile:PROFILE,policyVersion:POLICY,...PROJECT,scopeHash:hash(scope),expiresAt:Date.now()+600000,maxCalls:5,maxMicros:3600000,models:{chief:'gpt-6.1-sol',specialist:'gpt-6.1-sol',qa:'gpt-6.1-sol'},reasoning:'medium',visionEstimateAccepted:true,pricingVersion:'2026-10-11-sol61-standard-no-cache',schemaVersion:'hybrid-grounding-v2',chiefContractVersion:'chief-intent-v2'};
 if(approvalOrigin!==undefined)approval.deploymentOrigin=approvalOrigin;
 const org=createOrganization({read:async()=>raw,compare:async(before,after)=>{if(raw!==before)return false;raw=after;return true;}},{scope,runtime,liveApproval:()=>approval,workerRevocationToken:a=>require('../lib/agent-operations-worker-revocation').derive({workerSecret:secret,approval:a,runtime})});
 await org.prepareApproval(owner);await org.activateApproval(owner,{id:approval.id,expectedRevision:1});
 const claims={project_id:'prj_AkD7VoSNCE6fRYXQnXkX1ywGqjLX',owner_id:'team_6Rg3DdCrvOml6oEGwx6Ndf1I',environment:'development',nbf:Math.floor(Date.now()/1000)-1,exp:Math.floor(Date.now()/1000)+600};
 const env={VERCEL_ENV:'preview',CALLERCORE_AGENTOPS_ENABLED:'true',CALLERCORE_AGENTOPS_PAID_ENABLED:'true',CALLERCORE_AGENTOPS_SOL_ACCESS_VERIFIED:'true',CALLERCORE_AGENTOPS_SOL_VISION_ESTIMATE_ACCEPTED:'true',CALLERCORE_AGENTOPS_ORGANIZATION_APPROVAL:JSON.stringify(approval),CALLERCORE_AGENTOPS_OPENAI_PROJECT_ID:PROJECT.projectId,CALLERCORE_AGENTOPS_OPENAI_ORGANIZATION_ID:PROJECT.organizationId,CALLERCORE_AGENTOPS_OPENAI_API_KEY:'synthetic-fixture-never-a-real-api-key',CALLERCORE_AGENTOPS_WORKER_SECRET:secret,CALLERCORE_AGENTOPS_PREVIEW_ORIGIN:scope.origin,CALLERCORE_AGENTOPS_COMMIT:scope.commit,VERCEL_OIDC_TOKEN:'offline.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.not-a-real-signature',CALLERCORE_AGENTOPS_BROWSER_EXECUTABLE:path.resolve('__intentionally_missing_launcher_qa_browser__')};
 const fetchImpl=async(url,options={})=>{
  assert.equal(url,runtime.origin+'/api/agent-operations');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer '+secret);
  const body=options.body?JSON.parse(options.body):null;
  if(body){assert.equal(body.action,'organization-approval-revoke','No initialization, reservation or dispatch is permitted in these launch tests');revokes++;await org.controlApproval({kind:'worker'}, {id:body.input.id,type:'revoke',token:body.input.token});return{ok:true,status:200,json:async()=>({organization:await org.summary()})};}
  reads++;const state={runtime:{...runtime},paidExecution:true,organization:await org.summary()};
  if(reads===1&&patch)patch(state);
  return{ok:true,status:200,json:async()=>state};
 };
 return{runtime,approval,org,env,fetchImpl,providerFetch:async()=>{providerCalls++;throw Error('Paid provider trap must never be reached');},counts:()=>({reads,revokes,providerCalls})};
}
test('actual pilot launcher accepts central activation without impossible predeployment approval origin, then safely rejects missing dependency',async()=>{
 const f=await fixture();assert.equal(Object.hasOwn(f.approval,'deploymentOrigin'),false);
 await assert.rejects(launch.run({mode:'pilot',runtime:f.runtime,env:f.env,fetchImpl:f.fetchImpl,providerFetch:f.providerFetch}),error=>{assert.equal(error.cause.code,'ENOENT','Valid central binding must reach the deliberately missing browser dependency');assert.equal(error.shutdownConfirmed,true);return true;});
 assert.deepEqual(f.counts(),{reads:2,revokes:1,providerCalls:0});assert.equal((await f.org.summary()).approvals[0].status,'revoked');assert.equal((await f.org.summary()).workflows.length,0);
});
const invalid={
 'runtime origin':s=>s.runtime.origin='https://foreign.vercel.app',
 'runtime source':s=>s.runtime.commit='b'.repeat(40),
 'deployment origin':s=>s.organization.approvals[0].deploymentOrigin='https://foreign.vercel.app',
 'record source':s=>s.organization.approvals[0].sourceCommit='b'.repeat(40),
 'approval hash':s=>s.organization.approvals[0].approvalHash='0'.repeat(64),
 'task binding':s=>s.organization.approvals[0].workflowId='wf_'+'2'.repeat(32),
 'release digest':s=>s.organization.contractPreflight.digest='0'.repeat(64),
 'record release':s=>s.organization.approvals[0].contractHash='0'.repeat(64),
 'record lifecycle version':s=>s.organization.approvals[0].version='foreign-lifecycle',
 'expired approval':s=>s.organization.approvals[0].expiresAt=Date.now()-1,
 'expired lease':s=>s.organization.approvals[0].leaseUntil=Date.now()-1,
 'missing lease':s=>delete s.organization.approvals[0].leaseUntil,
 'NaN lease':s=>s.organization.approvals[0].leaseUntil=NaN,
 'string lease':s=>s.organization.approvals[0].leaseUntil=String(Date.now()+30000),
 'lease beyond approval expiry':s=>s.organization.approvals[0].leaseUntil=s.organization.approvals[0].expiresAt+1,
 'revoked record':s=>s.organization.approvals[0].status='revoked',
 'consumed record':s=>s.organization.approvals[0].status='consumed',
 'missing record':s=>s.organization.approvals=[],
 'disabled broker':s=>s.paidExecution=false,
 'disabled organization':s=>s.organization.paidExecution=false
};
for(const[name,patch]of Object.entries(invalid))test('actual launcher rejects '+name+' before dependencies/provider and cleans up',async()=>{
 const f=await fixture(patch);await assert.rejects(launch.run({mode:'pilot',runtime:f.runtime,env:f.env,fetchImpl:f.fetchImpl,providerFetch:f.providerFetch}),error=>{assert.equal(error.cause.message,'Authoritative activated deployment binding required');assert.equal(error.shutdownConfirmed,true);return true;});
 assert.deepEqual(f.counts(),{reads:2,revokes:1,providerCalls:0});assert.equal((await f.org.summary()).approvals[0].status,'revoked');assert.equal((await f.org.summary()).reservations.length,0);
});
test('explicit configured approval origin mismatch remains denied without erasing its authority binding',async()=>{
 const f=await fixture(undefined,{approvalOrigin:'https://foreign.vercel.app'});
 await assert.rejects(launch.run({mode:'pilot',runtime:f.runtime,env:f.env,fetchImpl:f.fetchImpl,providerFetch:f.providerFetch}),error=>{assert.equal(error.cause.message,'Separately authorized configured organizational pilot required');assert.equal(error.shutdownConfirmed,true);return true;});
 assert.deepEqual(f.counts(),{reads:1,revokes:1,providerCalls:0});assert.equal((await f.org.summary()).approvals[0].status,'revoked');
});
test('actual launcher storage failure cannot enter dependencies/provider; cleanup remains explicitly unconfirmed when storage remains unavailable',async()=>{
 const f=await fixture();let attempted=0;await assert.rejects(launch.run({mode:'pilot',runtime:f.runtime,env:f.env,fetchImpl:async()=>{attempted++;throw Error('Synthetic Redis unavailable');},providerFetch:f.providerFetch}),error=>{assert.equal(error.cause.message,'Synthetic Redis unavailable');assert.equal(error.shutdownConfirmed,false);assert.equal(error.requiresOwnerCleanup,true);return true;});
 assert.equal(attempted,2);assert.equal(f.counts().providerCalls,0);assert.equal((await f.org.summary()).workflows.length,0);
 // The isolated fixture does not claim revocation succeeded through failed storage.
 await f.org.controlApproval({kind:'worker'},{id:f.approval.id,type:'revoke',token:require('../lib/agent-operations-worker-revocation').derive({workerSecret:f.env.CALLERCORE_AGENTOPS_WORKER_SECRET,approval:f.approval,runtime:f.runtime})});
});
