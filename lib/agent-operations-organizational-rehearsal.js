'use strict';
// Owner-session controller and existing restricted-worker credential, isolated CAS
// ledger, immutable zero-paid profile. No provider client or paid credential here.
const crypto=require('node:crypto'),profile=require('./agent-operations-rehearsal-profile'),life=require('./agent-operations-approval-lifecycle'),orgModule=require('./agent-operations-organization'),{CAS}=require('./agent-operations-store');
const check=(v,m)=>{if(!v)throw Error(m);},digest=s=>crypto.createHash('sha256').update(s).digest('hex');
function createRehearsal({kv,env,runtime,scope,clock=Date.now}){
 function gate(cleanup=false){const until=Number(env.CALLERCORE_AGENTOPS_LIFECYCLE_VERIFY_UNTIL);check(env.VERCEL_ENV==='preview'&&env.CALLERCORE_AGENTOPS_ENABLED==='true'&&env.CALLERCORE_AGENTOPS_PAID_ENABLED==='false'&&(cleanup||Number.isSafeInteger(until)&&until>clock()&&until<=clock()+7200000),'Organizational rehearsal unavailable');return require('./agent-operations-contracts').assertRelease();}
 function owner(a){check(a?.kind==='owner'&&a.verifiedOwner===true&&typeof a.id==='string','Verified workspace owner required');}
 function key(nonce){check(/^[a-f0-9]{32}$/.test(nonce||''),'Exact rehearsal nonce required');return 'agentops:{preview}:organization-rehearsal:v1:'+nonce;}
 function adapter(nonce){const k=key(nonce);return{read:async()=>{const v=await kv.get(k);return v==null?null:typeof v==='string'?v:JSON.stringify(v);},compare:async(old,next)=>{check(Buffer.byteLength(next)<=990000,'Rehearsal ledger capacity');const r=Number(await kv.eval(CAS.replace('return 1',"redis.call('EXPIRE',KEYS[1],86400); return 1"),[k],[old||'',next]));check(r===0||r===1,'Rehearsal CAS unavailable');return r===1;}};}
 async function load(nonce,planned){const a=adapter(nonce),raw=await a.read(),definition=raw?JSON.parse(raw).operations?.rehearsalDefinition:planned;check(profile.isApproval(definition)&&definition.nonce===nonce&&definition.scopeHash===orgModule.hash(scope),'Rehearsal definition unavailable');return{approval:definition,organization:orgModule.createOrganization(a,{workerRevocationToken:approval=>require('./agent-operations-worker-revocation').derive({workerSecret:env.CALLERCORE_AGENTOPS_WORKER_SECRET,approval,runtime}),scope,runtime,clock,paidEnabled:()=>false,rehearsalApproval:()=>definition})};}
 async function start(actor,i,{authorize,signal,onEvent}={}){
  owner(actor);const release=gate();check(i&&Object.keys(i).length===2&&profile.SCENARIOS.includes(i.scenario),'Exact rehearsal selection required');key(i.nonce);
  const approval={id:'pilot_rehearsal_'+i.nonce,workflowId:'wf_'+digest(i.nonce).slice(0,32),lifecycleVersion:life.VERSION,sourceCommit:runtime.commit,deploymentOrigin:runtime.origin,ownerHash:digest(actor.id),scopeHash:orgModule.hash(scope),contractVersion:release.version,contractHash:release.digest,purpose:profile.PURPOSE,mode:'mock',nonce:i.nonce,scenario:i.scenario,authorized:false,maxCalls:0,maxMicros:0,expiresAt:Math.min(clock()+600000,Number(env.CALLERCORE_AGENTOPS_LIFECYCLE_VERIFY_UNTIL))};
  const {organization}=await load(i.nonce,approval);
  check(orgModule.hash(approval)===orgModule.hash((await load(i.nonce,approval)).approval),'Rehearsal replay binding denied');
  return require('./agent-operations-node-controller').supervisePilot({organization,owner:actor,approval,runtime,release,env,authorize,signal,onEvent});
 }
 async function inspect(actor,i){owner(actor);gate(true);check(i&&Object.keys(i).length===2&&['check','revoke'].includes(i.operation),'Exact rehearsal cleanup required');const {organization,approval}=await load(i.nonce);check(approval.ownerHash===digest(actor.id),'Foreign rehearsal denied');if(i.operation==='revoke')await organization.controlApproval(actor,{id:approval.id,type:'revoke'});return{runtime,release:gate(true),...(await organization.summary()),paidExecution:false,providerRequests:0};}
 async function worker(i){
  const release=gate(['organization-approval-revoke','organization-diagnostic'].includes(i?.body?.action));check(i&&Object.keys(i).length===2&&Object.hasOwn(i,'body'),'Exact rehearsal worker request required');const {organization,approval}=await load(i.nonce),summary=await organization.summary();
  check(approval.sourceCommit===runtime.commit&&approval.deploymentOrigin===runtime.origin&&approval.contractHash===release.digest&&approval.contractVersion===release.version,'Rehearsal worker release denied');
  const b=i.body;
  if(b?.action==='organization-approval-revoke'){check(Object.keys(b).length===2&&b.input?.id===approval.id&&Object.keys(b.input).sort().join()==='id,token','Exact rehearsal revocation capability required');return{status:200,body:{organization:await organization.controlApproval(null,{...b.input,type:'revoke'})}};}
  if(b===null)return{status:200,body:{runtime,paidExecution:false,organization:summary}};
  check((summary.controlAuthority===true||b?.action==='organization-diagnostic')&&b&&typeof b==='object'&&!Array.isArray(b)&&Buffer.byteLength(JSON.stringify(b))<=32000,'Rehearsal worker authority unavailable');
  if(b.action==='organization-rehearsal-initialize'){check(Object.keys(b).length===1,'Exact rehearsal initialization required');return{status:201,body:{organization:await organization.initializeRehearsal()}};}
  check(b.id===approval.workflowId&&Object.keys(b).every(k=>['action','id','token','command','input'].includes(k)),'Foreign rehearsal task denied');const actor={workflowId:b.id,token:b.token};
  const actions={'organization-diagnostic':()=>organization.recordDiagnostic(actor,b.id,b.input),'organization-read':()=>organization.readWorkflow(actor,b.id),'organization-chief-context':()=>organization.chiefContext(actor,b.id),'organization-command':()=>organization.command(actor,b.id,b.command),'organization-capture':()=>organization.registerEvidence(actor,b.id,b.input),'organization-assessment-read':()=>organization.readAssessment(actor,b.id),'organization-assess':()=>organization.assess(actor,b.id,b.input),'organization-assessment-fail':()=>organization.abortAssessment(actor,b.id,b.input)};
  check(Object.hasOwn(actions,b.action),'Rehearsal worker operation denied');return{status:200,body:{organization:await actions[b.action]()}};
 }
 return{start,inspect,worker};
}
module.exports={createRehearsal};
