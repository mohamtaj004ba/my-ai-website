'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),Module=require('node:module');
const transport=require('../lib/agent-operations-transport-verification'),contracts=require('../lib/agent-operations-contracts');
function fixture(){const rows=new Map(),keys=[],kv={get:async key=>{keys.push(key);return rows.get(key)??null;},eval:async(_script,[key],[old,next])=>{keys.push(key);if((rows.get(key)||'')!==old)return 0;rows.set(key,next);return 1;}},env={VERCEL_ENV:'preview',CALLERCORE_AGENTOPS_PAID_ENABLED:'false',CALLERCORE_AGENTOPS_LIFECYCLE_VERIFY_UNTIL:String(Date.now()+60000)},runtime={origin:'https://auditor-transport.vercel.app',commit:'a'.repeat(40)},owner={kind:'owner',verifiedOwner:true,id:'auditor-transport@example.test'},service=transport.createTransportVerification({kv,env,runtime}),input={nonce:crypto.randomBytes(16).toString('hex'),slot:0,scenario:'success'};return{rows,keys,env,runtime,owner,service,input};}
async function active(f){let ready;const activated=new Promise(resolve=>ready=resolve),abort=new AbortController();const running=f.service.start(f.owner,f.input,{authorize:async()=>true,signal:abort.signal,onEvent:e=>{if(e.phase==='activated')ready();}});await Promise.race([activated,running.then(r=>{throw Error('Controller failed before activation: '+JSON.stringify(r));})]);return{running,abort};}
test('Auditor transport: registered server context cannot be forged by a shape-correct inert approval',async()=>{
 const f=fixture(),release=contracts.assertRelease(),id='pilot_transport_'+f.input.nonce+'_0',approval={id,workflowId:'wf_'+crypto.createHash('sha256').update(id).digest('hex').slice(0,32),lifecycleVersion:'durable-approval-v1',purpose:transport.PURPOSE,mode:transport.MODE,scenario:'success',nonce:f.input.nonce,slot:0,sourceCommit:f.runtime.commit,ownerHash:'b'.repeat(64),contractVersion:release.version,contractHash:release.digest,scopeHash:'c'.repeat(64),expiresAt:Date.now()+10000,authorized:false,maxCalls:0,maxMicros:0};
 assert(transport.isApproval(approval));assert.throws(()=>transport.supervisorConfig({scope:{}},approval,f.runtime,release),/context/);
 for(const patch of [{authorized:true},{maxCalls:1},{maxMicros:1},{purpose:'paid-pilot'},{mode:'pilot'},{workflowId:'wf_'+'f'.repeat(32)}])assert.equal(transport.isApproval({...approval,...patch}),false);
 assert.equal(f.rows.size,0);
 let providerCalls=0;await assert.rejects(require('../lib/agent-operations-organization-provider').execute({mode:transport.MODE,scope:{}},{env:f.env,executionId:'exec_auditor',broker:{},fetchImpl:()=>providerCalls++}),/disabled/);
 await assert.rejects(require('../lib/agent-operations-organization-runner').runApproved({}, {workflow:{mode:transport.MODE}},{env:f.env,capture:()=>{},independentAssessment:()=>{},fetchImpl:()=>providerCalls++}),/dependencies/);assert.equal(providerCalls,0);
});
test('Auditor transport: same runWorker completes five inert HTTP boundaries without loading the paid runner or invoking provider transport',async()=>{
 const f=fixture(),control=await active(f),boot=await f.service.worker({...f.input,scenario:undefined,operation:'bootstrap'}).catch(()=>null);
 // Worker schema deliberately refuses even an undefined extraneous scenario key.
 assert.equal(boot,null);const {scenario,...selector}=f.input,bootstrap=await f.service.worker({...selector,operation:'bootstrap'}),load=Module._load;let brokerRequests=0,providerAttempts=0;
 try{
  // Release fingerprinting reads provider exports; invoking/loading the paid runner
  // is distinct and forbidden on this verification execution branch.
  Module._load=function(request,...args){if(/agent-operations-organization-runner/.test(request)){providerAttempts++;throw Error('Paid runner module forbidden in verification');}return load.call(this,request,...args);};
  const task=await require('../lib/agent-operations-remote-worker').runWorker({runtime:f.runtime,approval:bootstrap.approval,headers:{Authorization:'Bearer offline-worker-only'},env:f.env,providerFetch:()=>assert.fail('provider transport forbidden'),brokerFetch:async(url,options)=>{brokerRequests++;assert.equal(url,f.runtime.origin+'/api/agent-operations');const body=JSON.parse(options.body);assert.equal(body.action,'organization-transport-worker');return{ok:true,json:async()=>({transport:await f.service.worker(body.input)})};}});
  const result=await control.running;assert.equal(result.completed,true);assert.equal(task.boundaries,5);assert.equal(task.calls,0);assert.equal(task.outcomes.acceptedWork,false);assert.equal(result.shutdown.record.status,'revoked');assert.equal(brokerRequests,8);assert.equal(providerAttempts,0);
  for(const value of f.rows.values()){const s=JSON.parse(value);assert.equal(s.grants.length,0);assert.equal(s.reservations,undefined);assert.equal(s.workflows.length,1);assert.equal(s.workflows[0].mode,transport.MODE);}
  assert(f.keys.every(k=>k.startsWith('agentops:{preview}:transport-probe:v1:')));
 }finally{Module._load=load;control.abort.abort();await control.running;}
});
test('Auditor transport: capability, revision, order and foreign-owner attacks cannot advance task',async()=>{
 const f=fixture(),control=await active(f),{scenario,...selector}=f.input;
 try{const created=await f.service.worker({...selector,operation:'initialize'}),token=created.capability,before=[...f.rows.values()][0];
  for(const input of [{...selector,operation:'step',token:'f'.repeat(64),expectedRevision:1,index:1},{...selector,operation:'step',token,expectedRevision:0,index:1},{...selector,operation:'step',token,expectedRevision:1,index:2},{...selector,operation:'complete',token,expectedRevision:1},{...selector,operation:'step',token,expectedRevision:1,index:1,authorized:true}]){await assert.rejects(f.service.worker(input));assert.equal([...f.rows.values()][0],before);}
  await assert.rejects(f.service.inspect({...f.owner,id:'foreign-owner'}, {...selector,operation:'revoke'}),/Foreign/);assert.equal([...f.rows.values()][0],before);
  await f.service.inspect(f.owner,{...selector,operation:'revoke'});const out=await control.running;assert.equal(out.completed,false);assert(out.events.some(e=>e.phase==='initialization-admitted'&&e.status==='consumed'),'Actual worker consumed before supervisor admission; this historical race must be accepted with binding checks');await assert.rejects(f.service.worker({...selector,operation:'step',token,expectedRevision:1,index:1}),/authority/);
 }finally{control.abort.abort();await control.running;}
});
test('Auditor transport: fast authoritative terminal before supervisor polling is neither invented nor discarded',async()=>{
 const f=fixture(),control=await active(f),{scenario,...selector}=f.input;
 try{const created=await f.service.worker({...selector,operation:'initialize'});let task=created.workflow;
  for(let index=1;index<=5;index++)task=await f.service.worker({...selector,operation:'step',token:created.capability,expectedRevision:task.revision,index});
  task=await f.service.worker({...selector,operation:'complete',token:created.capability,expectedRevision:task.revision});
  const result=await control.running;assert.equal(result.completed,true);assert.deepEqual(result.result,task);assert.equal(result.result.outcomes.acceptedWork,false);assert.equal(result.shutdown.record.status,'revoked');assert.equal(result.result.calls,0);
 }finally{control.abort.abort();await control.running;}
});
