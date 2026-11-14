'use strict';
// Owner-controlled, one-off mock verification. Neither credential enters the child.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {launch,hostedBroker}=require('./agent-operations-launcher.cjs');
const {ORIGIN,oidcHeaders}=require('./agent-operations-preview-access.cjs');
async function main(){
  const privateDir=path.resolve(__dirname,'../../../private-agent-operations');
  const local=Object.fromEntries(fs.readFileSync(path.join(privateDir,'.env.agent-operations.local'),'utf8').split(/\r?\n/).filter(s=>s.includes('=')).map(s=>{const n=s.indexOf('=');return [s.slice(0,n),s.slice(n+1)];}));
  assert.equal(local.CALLERCORE_AGENTOPS_PAID_ENABLED,'false');assert.equal(local.CALLERCORE_AGENTOPS_WORKER_MODE,'mock');
  const runtime=JSON.parse(fs.readFileSync(path.join(privateDir,'broker-runtime.json'),'utf8'));
  const broker=hostedBroker({runtime,workerSecret:local.CALLERCORE_AGENTOPS_WORKER_SECRET,oidcToken:process.env.VERCEL_OIDC_TOKEN});
  const controller=new AbortController();let closed=false,phase='identity';
  const report={runtime,paidEnabled:false,modelRequests:0,checks:[],attestations:[]};
  const call=async(body,key=local.CALLERCORE_AGENTOPS_VERIFICATION_SECRET,method=body?'POST':'GET')=>{
    const r=await fetch(runtime.origin+'/api/agent-operations',{method,redirect:'error',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)]),headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',...oidcHeaders(process.env.VERCEL_OIDC_TOKEN)},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()};
  };
  const check=async(name,body,status,key,method)=>{const r=await call(body,key,method);assert.equal(r.status,status,name);report.checks.push({name,status});return r.body;};
  try{
    const start=await broker.read();assert.equal(start.paidExecution,false);assert.equal(start.scope.origin,ORIGIN);
    const initial=await check('verifier-authentication',undefined,200);assert.equal(initial.paidExecution,false);
    phase='denials';
    await check('wrong-broker-credential',undefined,401,'deliberately-wrong-worker');
    for(const body of [{action:'create-fixture',fixture:'third'},{action:'create-fixture',fixture:'happy',mode:'pilot'},{action:'create-fixture',fixture:'happy',objective:'changed'},{action:'initialize-pilot'},{action:'command',id:'foreign',command:{type:'claim'}}])await check('verifier-denied-'+body.action,body,403);
    for(const action of ['create','cancel','initialize-pilot','approve','release'])await check('worker-denied-'+action,{action},403,local.CALLERCORE_AGENTOPS_WORKER_SECRET);
    await check('worker-denied-foreign-task',{action:'command',id:'foreign',command:{type:'claim',expectedRevision:1}},403,local.CALLERCORE_AGENTOPS_WORKER_SECRET);
    phase='delegation';
    const happy=(await check('create-happy',{action:'create-fixture',fixture:'happy'},201)).task;
    const duplicate=(await check('idempotent-create',{action:'create-fixture',fixture:'happy'},201)).task;assert.equal(duplicate.id,happy.id);
    await launch({broker,taskId:happy.id,mode:'mock',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(90000)]),onAttestation:a=>report.attestations.push(a)});
    let state=await broker.read(),result=state.tasks.find(t=>t.id===happy.id);
    assert.equal(result.status,'verified');assert.equal(result.calls,4);assert.notEqual(result.results.inspect.executionId,result.results.review.executionId);assert.equal(result.results.inspect.evidenceHash,result.results.review.evidenceHash);assert.equal(result.usage.reduce((n,u)=>n+u.actualMicros,0),0);
    report.completedTask=result;report.completedReservations=state.reservations.filter(r=>r.taskId===happy.id);
    phase='cancellation';
    const cancel=(await check('create-cancel',{action:'create-fixture',fixture:'cancel'},201)).task;
    const worker=launch({broker,taskId:cancel.id,mode:'mock',delayMs:15000,signal:AbortSignal.any([controller.signal,AbortSignal.timeout(60000)]),onAttestation:a=>report.attestations.push(a)});worker.catch(()=>{});
    for(let n=0;n<15;n++){
      await new Promise(resolve=>setTimeout(resolve,500));state=await broker.read();result=state.tasks.find(t=>t.id===cancel.id);if(result.status==='running'&&result.calls===1)break;
    }
    assert.equal(result.status,'running');assert.equal(result.calls,1);
    await check('stale-cancel-revision',{action:'cancel-fixture',id:cancel.id,expectedRevision:0},409);
    await check('verifier-denied-foreign-cancel',{action:'cancel-fixture',id:'foreign',expectedRevision:1},403);
    await check('cancel-active-fixture',{action:'cancel-fixture',id:cancel.id,expectedRevision:result.revision},200);
    await worker;
    state=await broker.read();result=state.tasks.find(t=>t.id===cancel.id);assert.equal(result.status,'cancelled');assert.equal(result.calls,1);assert.equal(result.usage.length,0);
    const pending=state.reservations.find(r=>r.taskId===cancel.id);assert.equal(pending.status,'pending');
    await check('stale-completion-denied',{action:'command',id:cancel.id,command:{type:'finish',fence:result.fence,executionId:pending.executionId,actualMicros:0,model:'mock',result:{stage:'chief',delegate:'website-visual-qa',note:'must fail'}}},409,local.CALLERCORE_AGENTOPS_WORKER_SECRET);
    report.cancelledTask=result;report.cancelledReservation=pending;
    for(const a of report.attestations){assert.equal(a.vercelCredentialVariables,0);assert.equal(a.brokerCredentialVariables,0);assert.equal(a.privateFileReadDenied,true);assert.equal(a.childProcessAllowed,false);}
    assert.equal(report.attestations.length,2);
    phase='closure';
    await check('close-verification',{action:'close-verification'},200);closed=true;
    await check('closed-verifier-denied',undefined,403);await check('closed-create-denied',{action:'create-fixture',fixture:'happy'},403);
    assert.equal((await broker.read()).paidExecution,false);
    report.verificationClosed=true;report.verified=true;
    fs.mkdirSync('artifacts/agent-operations',{recursive:true});fs.writeFileSync('artifacts/agent-operations/hosted-mock-verification.json',JSON.stringify(report,null,2));
    process.stdout.write(JSON.stringify({verified:true,paidEnabled:false,modelRequests:0,completedTask:happy.id,cancelledTask:cancel.id,workerCredentialsPassed:0,verificationClosed:true})+'\n');
  }catch{process.stderr.write('Hosted mock verification unconfirmed at '+phase+'; no paid execution attempted.\n');process.exitCode=1;}
  finally{if(!closed){try{await call({action:'close-verification'});}catch{process.stderr.write('Verification closure requires read-back.\n');}}controller.abort();}
}
if(require.main===module)main();
module.exports={main};
