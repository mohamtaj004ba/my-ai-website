'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{fork}=require('node:child_process');
const {createStore,hash}=require('../lib/agent-operations-store');
const {PROJECT}=require('../lib/agent-operations-project');
const {MODEL,PRICING}=require('../lib/agent-operations-pilot');
const {scopedBridge,childEnvironment}=require('../scripts/agent-operations-launcher.cjs');
const {ORIGIN}=require('../scripts/agent-operations-preview-access.cjs');
const {EF}=require('../lib/agent-operations-evidence-first');
const {QA}=require('../lib/agent-operations-qa');
const sourceQA=require('./fixtures/agent-operations-qa-source.json');
const {SMOKE}=require('../lib/agent-operations-smoke');
const {SPECIALIST}=require('../lib/agent-operations-specialist');
const vm=require('../lib/agent-operations-visual-model');
async function offlinePilot(scenario){
  let raw=['qa','evidence_first','hybrid_sol'].includes(scenario)?JSON.stringify({version:1,revision:0,tasks:[structuredClone(sourceQA)],reservations:[]}):null,providerCalls=0,captures=0,attestation;
  const store=createStore({read:async()=>raw,compare:async(before,after)=>{if(raw!==before)return false;raw=after;return true;}},{scope:{origin:ORIGIN,commit:'8133597ff2fc5b48e3de42336e9e06fa4191c2a8'}});
  const hybrid=scenario==='hybrid_sol',first=scenario==='evidence_first',qa=scenario==='qa';
  const smoke=scenario.startsWith('smoke'),specialist=scenario==='specialist';
  const approval={...PROJECT,authorized:true,id:'pilot_offline_'+scenario,scopeHash:hash(store.scope),expiresAt:Date.now()+60000,maxMicros:first?EF.maxMicros:qa?QA.maxMicros:smoke?SMOKE.maxMicros:specialist?SPECIALIST.maxMicros:5000000,...(first?{profile:EF.profile,evaluationHash:EF.evaluationHash,maxCalls:2,sourceTaskId:EF.sourceTaskId,findingsHash:EF.findingsHash,evidenceHash:EF.evidenceHash}:qa?{profile:QA.profile,maxCalls:1,sourceTaskId:QA.sourceTaskId,findingsHash:QA.findingsHash,evidenceHash:QA.evidenceHash}:smoke?{profile:SMOKE.profile,maxCalls:SMOKE.calls}:specialist?{profile:SPECIALIST.profile,maxCalls:2}:{}),model:MODEL,pricingVersion:PRICING.version};
  if(hybrid)Object.assign(approval,vm.identity(),{modelAccessVerified:true,profile:vm.HYBRID.profile,maxMicros:vm.HYBRID.maxMicros,evaluationHash:vm.HYBRID.evaluationHash,maxCalls:2,sourceTaskId:vm.HYBRID.sourceTaskId,findingsHash:vm.HYBRID.findingsHash,evidenceHash:vm.HYBRID.evidenceHash});
  const task=await store.create({principal:'offline-test',idempotencyKey:'offline_child_'+scenario,objective:hybrid?vm.HYBRID.objective:first?EF.objective:qa?QA.objective:smoke?SMOKE.objective:specialist?SPECIALIST.objective:'Synthetic offline inspection only',mode:'pilot',approval});approval.taskId=task.id;
  const bridge=scopedBridge({broker:{read:async()=>({...await store.read(),paidExecution:true,pilotApproval:approval}),command:store.command},taskIds:[task.id],mode:'pilot',loadEvidence:s=>require('../scripts/agent-operations-qa-evidence.cjs').loadEvidence(s,{directory:path.join(__dirname,'fixtures/agent-operations-qa')}),capture:async(scope,{executionId})=>{captures++;if(specialist)return ['legal','pricing'].flatMap(name=>[1440,390].map(viewport=>({sha256:require('node:crypto').createHash('sha256').update(Buffer.from([0])).digest('hex'),path:executionId+'-'+name+'-'+viewport+'.png',viewport,capturedAt:Date.now(),dataUrl:'data:image/png;base64,AA=='})));return [0,1,2,3].map(n=>({sha256:String(n).repeat(64),path:'offline-'+n+'.png',viewport:n%2?390:1440,dataUrl:'data:image/png;base64,AA=='}));}});
  const fixture=path.resolve('tests/fixtures/agent-operations-offline-child.cjs'),worker=path.resolve('scripts/agent-operations-worker.cjs');
  const env=childEnvironment({...process.env,CALLERCORE_AGENTOPS_PAID_ENABLED:'true',CALLERCORE_AGENTOPS_OPENAI_API_KEY:'synthetic-offline-key',CALLERCORE_AGENTOPS_OPENAI_PROJECT_ID:PROJECT.projectId,CALLERCORE_AGENTOPS_OPENAI_ORGANIZATION_ID:PROJECT.organizationId,VERCEL_TOKEN:'must-not-pass',VERCEL_OIDC_TOKEN:'must-not-pass',CALLERCORE_AGENTOPS_WORKER_SECRET:'must-not-pass'},'pilot');
  env.OFFLINE_PROVIDER_SCENARIO=scenario;
  const child=fork(fixture,[],{env,execArgv:['--permission','--allow-fs-read='+path.resolve('lib'),'--allow-fs-read='+fixture,'--allow-fs-read='+worker,'--allow-fs-read='+path.resolve('package.json')],stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});
  let output='',stderr='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>stderr+=b);
  child.on('message',async m=>{if(m.offlineProvider){providerCalls=m.offlineProvider.calls;return;}if(m.attestation){attestation=m.attestation;return;}try{const value=await bridge(m.request);if(child.connected)child.send({reply:m.id,ok:true,value});}catch{if(child.connected)child.send({reply:m.id,ok:false});}});
  const completion=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill();reject(Error('Offline worker timed out'));},10000);child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('exit',code=>{clearTimeout(timer);if(code!==0)reject(Error('Offline worker failed: '+stderr));else resolve();});});
  child.send({type:'start',mode:'pilot',taskIds:[task.id],delayMs:0});await completion;
  assert.equal(attestation.vercelCredentialVariables,0);assert.equal(attestation.brokerCredentialVariables,0);assert.equal(attestation.privateFileReadDenied,true);assert.equal(attestation.childProcessAllowed,false);assert.equal(attestation.permissionModel,true);
  assert.equal(output.includes('synthetic-offline-key'),false);
  return {...await store.read(),providerCalls,captures};
}
test('actual restricted QA-only worker sends four original high-detail images and persists one separate terminal verdict without capture',async()=>{
 const state=await offlinePilot('qa'),task=state.tasks.find(t=>t.profile===QA.profile);assert.equal(state.providerCalls,1);assert.equal(state.captures,0);assert.equal(task.status,'verified');assert.equal(task.stage,'review');assert.equal(task.calls,1);assert.deepEqual(Object.keys(task.results),['qaVerdict']);assert.equal(task.results.qaVerdict.findings.length,4);assert.equal(task.results.qaVerdict.decision,'reject');assert.equal(state.reservations.length,1);assert.equal(state.reservations[0].status,'settled');assert.deepEqual(state.tasks[0],sourceQA);
});

test('actual restricted evidence-first worker observes blind, cannot read evaluator key, then adjudicates once; agreeable verdict fails acceptance',async()=>{
 const state=await offlinePilot('evidence_first'),task=state.tasks.find(t=>t.profile===EF.profile);assert.equal(state.providerCalls,2);assert.equal(state.captures,0);assert.equal(task.status,'verified');assert.equal(task.calls,2);assert.equal(task.outcomes.substantive,'failed');assert.equal(task.outcomes.acceptedWork,false);assert.equal(task.outcomes.finalAcceptance,'rejected');assert(task.results.qaObservation.hash);assert.equal(task.results.qaClaimVerdicts.observationHash,task.results.qaObservation.hash);assert.notEqual(task.results.qaObservation.executionId,task.results.qaClaimVerdicts.executionId);assert.equal(state.reservations.length,2);assert(state.reservations.every(r=>r.status==='settled'));assert.deepEqual(state.tasks[0],sourceQA);
});

test('actual restricted Sol Medium child seals blind observations then evaluates all 15 visual cases with strict schemas and zero capture; agreement fails acceptance',async()=>{
 const state=await offlinePilot('hybrid_sol'),task=state.tasks.find(t=>t.profile===vm.HYBRID.profile);assert.equal(state.providerCalls,2,JSON.stringify(task.events.at(-1)));assert.equal(state.captures,0);assert.equal(task.status,'verified');assert.equal(task.calls,2);assert.equal(task.outcomes.execution,'completed');assert.equal(task.outcomes.structural,'passed');assert.equal(task.outcomes.evidenceIntegrity,'passed');assert.equal(task.outcomes.completion.totalCases,16);assert.equal(task.outcomes.completion.visualReturned,15);assert.equal(task.outcomes.completion.integrityRejected,1);assert.equal(task.outcomes.metrics.falseApprovals,9);assert.equal(task.outcomes.metrics.falseRejections,0);assert.equal(task.outcomes.substantive,'failed');assert.equal(task.outcomes.acceptedWork,false);assert.equal(task.outcomes.finalAcceptance,'rejected');assert(task.results.qaObservation.hash);assert.equal(task.results.qaClaimVerdicts.observationHash,task.results.qaObservation.hash);assert.equal(task.results.qaClaimVerdicts.findings.reduce((n,f)=>n+f.atoms.length,0),22);assert.notEqual(task.results.qaObservation.executionId,task.results.qaClaimVerdicts.executionId);assert.equal(state.reservations.length,2);assert(state.reservations.every(r=>r.ceilingMicros===500000&&r.status==='settled'));assert.equal(task.usage.reduce((n,u)=>n+u.actualMicros,0),4400);assert.deepEqual(state.tasks[0],sourceQA);
});

test('exact restricted pilot worker completes four stages with synthetic Responses and zero external network',async()=>{
  const state=await offlinePilot('success'),task=state.tasks[0];assert.equal(state.providerCalls,4);assert.equal(state.captures,2);assert.equal(task.status,'verified');assert.equal(task.usage.length,4);assert.equal(task.usage.reduce((n,u)=>n+u.actualMicros,0),2400);assert.ok(state.reservations.every(r=>r.status==='settled'));assert.notEqual(task.results.inspect.executionId,task.results.review.executionId);
});
test('actual restricted specialist-only worker persists two separate executions and fresh evidence then terminates without QA',async()=>{
  const state=await offlinePilot('specialist'),task=state.tasks[0];assert.equal(state.providerCalls,2,JSON.stringify({status:task.status,stage:task.stage,captures:state.captures,diagnostic:task.events.at(-1)?.diagnostic}));assert.equal(state.captures,1);assert.equal(task.status,'verified');assert.equal(task.stage,'inspect');assert.equal(task.calls,2);assert.equal(task.costCeilingMicros,600000);assert.deepEqual(Object.keys(task.results),['chief','inspect']);assert.equal(task.results.inspect.artifacts.length,4);assert.notEqual(task.results.chief.executionId,task.results.inspect.executionId);assert(state.reservations.every(r=>r.status==='settled'));assert.equal(task.usage.length,2);
});
test('exact restricted pilot worker blocks after synthetic provider denial and retains its reservation',async()=>{
  const state=await offlinePilot('deny'),task=state.tasks[0];assert.equal(state.providerCalls,1);assert.equal(state.captures,0);assert.equal(task.status,'blocked');assert.equal(task.calls,1);assert.equal(task.usage.length,0);assert.equal(state.reservations.length,1);assert.equal(state.reservations[0].status,'pending');assert.equal(state.reservations[0].ceilingMicros,300000);const d=task.events.find(e=>e.type==='execution_blocked').diagnostic;assert.equal(d.phase,'provider_http');assert.equal(d.requestAttempted,true);assert.equal(d.httpStatus,403);assert.equal(d.code,'insufficient_permissions');
});

test('restricted child preserves safe provider format summary and parameter over actual IPC',async()=>{
  const state=await offlinePilot('format'),task=state.tasks[0],d=task.events.at(-1).diagnostic;assert.equal(state.providerCalls,1);assert.equal(state.captures,0);assert.equal(task.status,'blocked');assert.equal(task.usage.length,0);assert.equal(d.httpStatus,400);assert.equal(d.requestId,'req_offline_format');assert.equal(d.providerParam,'text.format');assert.equal(d.providerMessage,'JSON mode requires an explicit JSON instruction in request context.');assert.equal(d.code,'invalid_request_error');assert(state.reservations[0].evidence.some(e=>e.providerParam==='text.format'));assert.equal(state.reservations[0].status,'pending');assert.equal(JSON.stringify(state).includes('PRIVATE_SYNTHETIC_PAYLOAD'),false);
});

test('actual restricted smoke worker persists one Chief receipt and stops without capture or delegation',async()=>{
  const state=await offlinePilot('smoke'),task=state.tasks[0];assert.equal(state.providerCalls,1);assert.equal(state.captures,0);assert.equal(task.profile,SMOKE.profile);assert.equal(task.status,'verified');assert.equal(task.stage,'chief');assert.equal(task.calls,1);assert.equal(task.usage.length,1);assert.equal(task.results.chief.note,'SMOKE_OK');assert.equal(task.results.chief.delegate,undefined);assert.equal(state.reservations[0].status,'settled');assert.equal(task.results.inspect,undefined);
});
test('actual restricted smoke worker retains redacted provider wording and unknown charge on rejection',async()=>{
  const state=await offlinePilot('smoke_format'),task=state.tasks[0],d=task.events.at(-1).diagnostic;assert.equal(state.providerCalls,1);assert.equal(state.captures,0);assert.equal(task.status,'blocked');assert.equal(d.requestId,'req_offline_smoke');assert.equal(d.httpStatus,400);assert.equal(d.providerParam,'input');assert.match(d.providerErrorMessage,/invalid input: expected a string/);assert.match(d.providerErrorMessage,/\[REDACTED\]/);assert.equal(state.reservations[0].status,'pending');assert.equal(task.usage.length,0);for(const secret of ['PRIVATE_SYNTHETIC_PAYLOAD','synthetic-offline-key','private.example','SENSITIVE_UNKNOWN_VALUE'])assert.equal(JSON.stringify(state).includes(secret),false);
});
