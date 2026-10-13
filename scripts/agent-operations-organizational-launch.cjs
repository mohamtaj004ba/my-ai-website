'use strict';
// Tracked trusted composition. Does not issue approvals, activate controllers or impersonate owners.
const fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'..'),access=require('./agent-operations-preview-access.cjs');
const scope=Object.freeze({origin:access.ORIGIN,commit:'8133597ff2fc5b48e3de42336e9e06fa4191c2a8',paths:['/industries/legal','/#pricing']});
function binding(runtime){if(!/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(runtime?.origin||'')||!/^[a-f0-9]{40}$/.test(runtime?.commit||''))throw Error('Exact Preview runtime required');}
async function check({runtime,env=process.env,mode='rehearsal',outputDir=path.join(root,'artifacts/agent-operations'),signal}={}){
 binding(runtime);
 if(signal?.aborted||!['rehearsal','pilot'].includes(mode)||Number(process.versions.node.split('.')[0])<22||typeof process.allowedNodeEnvironmentFlags?.has!=='function'||!process.allowedNodeEnvironmentFlags.has('--permission'))throw Error('Supported organizational runtime required');
 if(typeof env.CALLERCORE_AGENTOPS_WORKER_SECRET!=='string'||env.CALLERCORE_AGENTOPS_WORKER_SECRET.length<32)throw Error('Existing restricted worker credential required');
 if(mode==='rehearsal'&&env.CALLERCORE_AGENTOPS_PAID_ENABLED!=='false')throw Error('Rehearsal requires paid execution disabled');
 if(env.CALLERCORE_AGENTOPS_PREVIEW_ORIGIN!==scope.origin||env.CALLERCORE_AGENTOPS_COMMIT!==scope.commit)throw Error('Pinned inspection scope required');
 access.oidcHeaders(env.VERCEL_OIDC_TOKEN);
 const release=require('../lib/agent-operations-contracts').assertRelease();access.offlineFonts();
 const playwright=require('playwright'),browserPath=env.CALLERCORE_AGENTOPS_BROWSER_EXECUTABLE||playwright.chromium.executablePath();
 if(typeof browserPath!=='string'||!path.isAbsolute(browserPath)||(await fs.stat(browserPath)).isFile()!==true)throw Error('Installed capture browser required');
 const browserEnv=Object.fromEntries(['PATH','SystemRoot','TEMP','TMP','USERPROFILE','LOCALAPPDATA','APPDATA','HOME'].filter(k=>env[k]).map(k=>[k,env[k]]));
 const browser=await playwright.chromium.launch({headless:true,timeout:10000,executablePath:browserPath,env:browserEnv,args:['--disable-background-networking','--disable-component-update']});
 try{if(signal?.aborted)throw Error('Runtime dependency check cancelled');}finally{await browser.close();}
 const artifacts=path.join(root,'artifacts/agent-operations'),resolved=path.resolve(outputDir);
 if(resolved!==artifacts&&!resolved.startsWith(artifacts+path.sep))throw Error('Isolated evidence directory required');
 await fs.mkdir(resolved,{recursive:true});
 if(await fs.realpath(resolved)!==resolved||await fs.realpath(artifacts)!==artifacts)throw Error('Evidence directory links denied');
 const probe=path.join(resolved,'.dependency-'+require('node:crypto').randomBytes(16).toString('hex'));
 try{await fs.writeFile(probe,'nonbillable-dependency-check',{flag:'wx'});}finally{await fs.unlink(probe).catch(()=>{});}
 if(typeof require('../lib/agent-operations-independent-assessment').assess!=='function')throw Error('Independent assessment dependency required');
 if(mode==='pilot')require('../lib/agent-operations-project').workerCredential(env);
 return{runtime:{...runtime},release,scope:structuredClone(scope),outputDir:resolved,browserPath,browserAvailable:true,paidDispatchEnabled:false};
}
async function run({runtime,env=process.env,mode='rehearsal',nonce,outputDir,fetchImpl=fetch,providerFetch,signal,onEvent=()=>{}}={}){
 // The zero-paid profile never accepts an injected provider. Only fixed controlled responses exist in its driver branch.
 if(mode==='rehearsal'&&(!/^[a-f0-9]{32}$/.test(nonce||'')||providerFetch!==undefined))throw Error('Exact nonbillable rehearsal selection required');
 if(mode!=='rehearsal'&&mode!=='pilot')throw Error('Explicit organizational mode required');
 binding(runtime);let ready;const endpoint=runtime.origin+'/api/agent-operations';
 const headers={Authorization:'Bearer '+env.CALLERCORE_AGENTOPS_WORKER_SECRET,...access.oidcHeaders(env.VERCEL_OIDC_TOKEN)};
 async function brokerFetch(url,options={}){
  if(url!==endpoint||options.redirect!=='error'||!['GET','POST'].includes(options.method||'GET'))throw Error('Exact organizational broker required');
  const body=options.body?JSON.parse(options.body):null;
  const response=await fetchImpl(endpoint,{...options,cache:'no-store',redirect:'error',headers:{...headers,'Content-Type':'application/json'},...(mode==='rehearsal'?{method:'POST',body:JSON.stringify({action:'organization-rehearsal-worker',input:{nonce,body}})}:{})});
  const value=await response.json();
  if(mode!=='rehearsal')return{ok:response.ok,status:response.status,json:async()=>value};
  const inner=value.rehearsal;
  if(!response.ok||!inner||!Number.isSafeInteger(inner.status)||inner.status<100||inner.status>599||!inner.body)return{ok:false,status:response.ok?502:response.status,json:async()=>({error:'Rehearsal broker unavailable'})};
  return{ok:inner.status>=200&&inner.status<300,status:inner.status,json:async()=>inner.body};
 }
 let approval;
 try{
 if(mode==='rehearsal'){
  const response=await brokerFetch(endpoint,{redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)}),state=await response.json();
  approval=state.organization?.rehearsal;
  if(!response.ok||state.paidExecution!==false||state.runtime?.origin!==runtime.origin||state.runtime?.commit!==runtime.commit||!require('../lib/agent-operations-rehearsal-profile').isApproval(approval)||approval.nonce!==nonce||approval.contractHash!==require('../lib/agent-operations-contracts').assertRelease().digest)throw Error('Active exact rehearsal unavailable');
 }else{
  approval=require('../lib/agent-operations-organization-approval').approval(env,scope);
  if(!approval||approval.sourceCommit!==runtime.commit||Object.hasOwn(approval,'deploymentOrigin')&&approval.deploymentOrigin!==runtime.origin||typeof providerFetch!=='function')throw Error('Separately authorized configured organizational pilot required');
  // Vercel assigns the immutable URL after configuration is frozen. Activation
  // binds it centrally; never invent or rewrite the signed approval's identity.
  const response=await brokerFetch(endpoint,{redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)}),state=await response.json();
  const organization=state.organization,record=organization?.approvals?.find(r=>r.id===approval.id),release=require('../lib/agent-operations-contracts').assertRelease();
  if(!response.ok||state.runtime?.origin!==runtime.origin||state.runtime?.commit!==runtime.commit||state.paidExecution!==true||organization?.paidExecution!==true||organization.contractPreflight?.version!==release.version||organization.contractPreflight?.digest!==release.digest||record?.status!=='active'||record.version!==approval.lifecycleVersion||!Number.isSafeInteger(record.leaseUntil)||record.leaseUntil>record.expiresAt||record.workflowId!==approval.workflowId||record.approvalHash!==require('../lib/agent-operations-organization').hash(approval)||record.deploymentOrigin!==runtime.origin||record.sourceCommit!==runtime.commit||record.contractVersion!==approval.contractVersion||record.contractHash!==approval.contractHash||record.expiresAt!==approval.expiresAt||record.expiresAt<=Date.now()||record.leaseUntil<=Date.now())throw Error('Authoritative activated deployment binding required');
 }
 ready=await check({runtime,env,mode,outputDir,signal});
 return await require('./agent-operations-organizational-driver.cjs').run({runtime,approval,headers,env,scope,brokerFetch,signal,onEvent,
  capture:(captureScope,options)=>require('./agent-operations-capture.cjs').capture(captureScope,{...options,outputDir:ready.outputDir,browserExecutable:ready.browserPath,oidcToken:env.VERCEL_OIDC_TOKEN}),
  independentAssessment:require('../lib/agent-operations-independent-assessment').assess,...(mode==='pilot'?{providerFetch}:{})});
 }catch(error){
  // Bound revocation is available even when dependency checks or initialization
  // fail. No owner session, activation permission or new credential is needed.
  let shutdownConfirmed=false;
  try{const token=require('../lib/agent-operations-worker-revocation').derive({workerSecret:env.CALLERCORE_AGENTOPS_WORKER_SECRET,approval,runtime});const r=await brokerFetch(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),body:JSON.stringify({action:'organization-approval-revoke',input:{id:approval.id,token}})});if(!r.ok)throw Error('Revoke unconfirmed');const read=await brokerFetch(endpoint,{redirect:'error',signal:AbortSignal.timeout(15000)}),s=await read.json(),rec=s.organization?.approvals?.find(r=>r.id===approval.id);shutdownConfirmed=read.ok&&rec?.status==='revoked'&&rec.leaseUntil===0;}catch{}
  throw Object.assign(Error('Tracked organizational launch stopped'),{cause:error,shutdownConfirmed,requiresOwnerCleanup:!shutdownConfirmed});
 }
}
async function main(args=process.argv.slice(2)){
 if(args.length===5&&args[0]==='--pilot'&&args[1]==='--origin'&&args[3]==='--source'){
  // Explicit invocation still cannot create, activate, renew or widen approval.
  // Parent native transport is selected here, never supplied by the model/child.
  return run({mode:'pilot',runtime:{origin:args[2],commit:args[4]},providerFetch:fetch,signal:AbortSignal.timeout(600000),onEvent:event=>process.stdout.write(JSON.stringify(event)+'\n')});
 }
 if(args.length!==6||args[0]!=='--rehearsal'||args[2]!=='--origin'||args[4]!=='--source')throw Error('Explicit rehearsal nonce, origin and source required');
 await run({mode:'rehearsal',nonce:args[1],runtime:{origin:args[3],commit:args[5]},signal:AbortSignal.timeout(600000),onEvent:event=>process.stdout.write(JSON.stringify(event)+'\n')});
}
if(require.main===module)main().catch(()=>{process.stderr.write('Organizational launch stopped; verify persisted owner cleanup status.\n');process.exitCode=1;});
module.exports={check,run,main};
