'use strict';
// Inactive preparation boundary. Only the server credential broker may mint installation tokens.
// The existing gateway must provide durable admission/revalidation; this module grants no authority.
const {createHash}=require('node:crypto');
const REPOSITORY='mohamtaj004ba/my-ai-website', VERSION='github-app-read-boundary-v1';
const PERMISSIONS=Object.freeze({metadata:'read',contents:'read',actions:'read'});
const SAFE_ERRORS=new Set(['GH_CONFIGURATION_REQUIRED','GH_APP_ID_INVALID','GH_PROVIDER_DENIED','GH_RESPONSE_BOUNDS','GH_REQUEST_DENIED','GH_OPERATION_DISABLED','GH_TRUSTED_DEPENDENCY_REQUIRED','GH_CANCELLED','GH_TIMEOUT','GH_AUTHORITY_DENIED','GH_CREDENTIAL_SCOPE_DENIED','GH_REPOSITORY_SCOPE_DENIED','GH_RESPONSE_INVALID']);
const BROKER_DIAGNOSTICS=Object.freeze(['GH_BROKER_SCOPE','GH_BROKER_KEY_UNAVAILABLE','GH_BROKER_KEY_INVALID','GH_BROKER_INSTALLATION_DENIED','GH_BROKER_TOKEN_INVALID','GH_BROKER_PERMISSIONS_DENIED','GH_BROKER_REPOSITORY_DENIED','GH_BROKER_PROVIDER_UNAUTHORIZED','GH_BROKER_PROVIDER_FORBIDDEN','GH_BROKER_PROVIDER_REJECTED','GH_BROKER_PROVIDER_UNAVAILABLE','GH_BROKER_AUTHENTICATION_UNCONFIRMED','GH_BROKER_AUTHORITY_DENIED','GH_BROKER_CANCELLED','GH_BROKER_RESPONSE_BOUNDS']);
function failureCode(error){if(BROKER_DIAGNOSTICS.some(code=>error?.message==='INT_GITHUB_'+code.slice('GH_BROKER_'.length)))return error.message;const code=error?.message;return SAFE_ERRORS.has(code)||code==='GH_TRANSPORT_OR_CONTRACT_UNAVAILABLE'?'INT_GITHUB_APP_'+code.slice(3):'INT_READ_UNCONFIRMED';}
const fail=c=>{throw Error(c);},check=(x,c)=>{if(!x)fail(c);};
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const PHASES=Object.freeze(['authorize','credential-broker','credential-read','installation-get','token-post','repository-get','ci-get','commit-get','installation-body','token-body','repository-body','ci-body','commit-body']);
const failureDiagnostics=new WeakMap();
function diagnosticsFor(error){return failureDiagnostics.get(error)||null;}
function createDiagnostics(clock){
 const start=clock(),events=[],active=[];let closed=false;
 const elapsed=x=>Math.max(0,Math.min(6000,Math.trunc(clock()-x)||0));
 const category=r=>r?.ok===false?([401,403,429].includes(r.status)?'http-'+r.status:r.status>=500&&r.status<=599?'http-5xx':'http-other'):'completed';
 return Object.freeze({async span(phase,fn){check(PHASES.includes(phase),'GH_REQUEST_DENIED');const item={phase,start:clock()};if(!closed)active.push(item);let outcome='unconfirmed';try{const result=await fn();outcome=category(result);return result;}finally{if(!closed){active.splice(active.indexOf(item),1);if(events.length<64)events.push(Object.freeze({phase,elapsedMs:elapsed(item.start),outcome}));}}},seal(){closed=true;return Object.freeze({version:'github-phase-diagnostics-v1',deadlineMs:6000,totalElapsedMs:elapsed(start),activePhases:Object.freeze(active.map(x=>x.phase).slice(0,8)),events:Object.freeze([...events]),authorizationCount:events.filter(x=>x.phase==='authorize').length,authorizationElapsedMs:Math.min(6000,events.filter(x=>x.phase==='authorize').reduce((n,x)=>n+x.elapsedMs,0))});}});
}
function configuration(c){check(c&&c.environment==='preview'&&c.repository===REPOSITORY&&Number.isSafeInteger(c.repositoryId)&&c.repositoryId>0&&Number.isSafeInteger(c.installationId)&&c.installationId>0&&typeof c.credentialReference==='string'&&/^[a-zA-Z0-9:_-]{1,160}$/.test(c.credentialReference),'GH_CONFIGURATION_REQUIRED');return c;}
function jwtClaims(appClientId,now=Date.now()){check(typeof appClientId==='string'&&/^[a-zA-Z0-9_]{1,80}$/.test(appClientId)&&Number.isSafeInteger(now),'GH_APP_ID_INVALID');return{iat:Math.floor(now/1000)-60,exp:Math.floor(now/1000)+480,iss:appClientId};}
function tokenRequest(c){configuration(c);return{installationId:c.installationId,repository_ids:[c.repositoryId],permissions:{...PERMISSIONS},credentialReference:c.credentialReference};}
async function boundedJson(response){check(response?.ok,'GH_PROVIDER_DENIED');check(Number(response.headers.get('content-length')||0)<=250000,'GH_RESPONSE_BOUNDS');let size=0;const parts=[];for await(const p of response.body){size+=p.length;check(size<=250000,'GH_RESPONSE_BOUNDS');parts.push(p);}return JSON.parse(Buffer.concat(parts).toString('utf8'));}
function operation(input){check(input&&Object.keys(input).every(k=>['kind','sourceCommit'].includes(k))&&/^[a-f0-9]{40}$/.test(input.sourceCommit||''),'GH_REQUEST_DENIED');const prefix='/repos/'+REPOSITORY;switch(input.kind){case 'commit':return prefix+'/commits/'+input.sourceCommit;case 'ci':return prefix+'/actions/runs?head_sha='+input.sourceCommit+'&per_page=12';default:fail('GH_OPERATION_DISABLED');}}
function create({config,credentialBroker,authorize,fetchImpl=fetch,clock=Date.now}={}){
 config=Object.freeze({...configuration(config)});check(typeof credentialBroker==='function'&&typeof authorize==='function','GH_TRUSTED_DEPENDENCY_REQUIRED');
 return Object.freeze({async inspect(input,{signal}={}){
  input=Object.freeze({...input});
  const path=operation(input),start=clock(),trace=createDiagnostics(clock),deadline=new AbortController(),timer=setTimeout(()=>deadline.abort(),6000);let token;
  const executionSignal=signal?AbortSignal.any([signal,deadline.signal]):deadline.signal;
  async function bounded(p){if(executionSignal.aborted)fail(signal?.aborted?'GH_CANCELLED':'GH_TIMEOUT');let stop;try{return await Promise.race([p,new Promise((_,reject)=>{stop=()=>reject(Error(signal?.aborted?'GH_CANCELLED':'GH_TIMEOUT'));executionSignal.addEventListener('abort',stop,{once:true});})]);}finally{if(stop)executionSignal.removeEventListener('abort',stop);}}
  // No retries and no token cache; local or provider revocation must be revalidated for every read.
  async function guard(){check(!signal?.aborted,'GH_CANCELLED');check(!executionSignal.aborted&&clock()-start<6000,'GH_TIMEOUT');check(await bounded(trace.span('authorize',()=>Promise.resolve().then(()=>authorize())))===true,'GH_AUTHORITY_DENIED');}
  async function get(path){await guard();const phase=path.startsWith('/installation/')?'repository':input.kind;const r=await bounded(trace.span(phase+'-get',()=>fetchImpl('https://api.github.com'+path,{method:'GET',redirect:'error',signal:executionSignal,headers:{Accept:'application/vnd.github+json','User-Agent':'CallerCore-scoped-GitHub-App','X-GitHub-Api-Version':'2022-11-28',Authorization:'Bearer '+token}})));return bounded(trace.span(phase+'-body',()=>boundedJson(r)));}
  try{
   await guard();const lease=await bounded(trace.span('credential-broker',()=>credentialBroker(tokenRequest(config),{signal:executionSignal,diagnostics:trace})));await guard();
   check(lease&&typeof lease.token==='string'&&/^ghs_[A-Za-z0-9_.-]{8,8192}$/.test(lease.token)&&lease.installationId===config.installationId&&lease.repositoryId===config.repositoryId&&lease.repository===REPOSITORY&&Number.isSafeInteger(lease.expiresAt)&&lease.expiresAt>clock()+10000&&lease.expiresAt<=clock()+3600000,'GH_CREDENTIAL_SCOPE_DENIED');
   check(lease.permissions&&Object.entries(lease.permissions).every(([key,value])=>PERMISSIONS[key]==='read'&&value==='read')&&Object.keys(PERMISSIONS).every(k=>lease.permissions[k]==='read'),'GH_CREDENTIAL_SCOPE_DENIED');token=lease.token;
   const inventory=await get('/installation/repositories?per_page=2');
   check(inventory.total_count===1&&Array.isArray(inventory.repositories)&&inventory.repositories.length===1&&inventory.repositories[0].id===config.repositoryId&&inventory.repositories[0].full_name===REPOSITORY,'GH_REPOSITORY_SCOPE_DENIED');
   const raw=await get(path);let evidence;
   if(input.kind==='commit'){check(raw.sha===input.sourceCommit&&Array.isArray(raw.parents)&&raw.parents.length<=8,'GH_RESPONSE_INVALID');evidence={sha:raw.sha,parentShas:raw.parents.map(p=>{check(/^[a-f0-9]{40}$/.test(p.sha),'GH_RESPONSE_INVALID');return p.sha;})};}
   else{check(Array.isArray(raw.workflow_runs)&&raw.workflow_runs.length<=12,'GH_RESPONSE_INVALID');evidence={runs:raw.workflow_runs.map(r=>{check(Number.isSafeInteger(r.id)&&r.id>0&&r.head_sha===input.sourceCommit&&['queued','in_progress','completed','waiting','pending','requested'].includes(r.status)&&[null,'success','failure','cancelled','skipped','timed_out','action_required','neutral','stale','startup_failure'].includes(r.conclusion),'GH_RESPONSE_INVALID');return{id:r.id,sourceCommit:r.head_sha,status:r.status,conclusion:r.conclusion};})};}
   await guard();const receipt={version:VERSION,repository:REPOSITORY,installationId:config.installationId,repositoryId:config.repositoryId,sourceCommit:input.sourceCommit,kind:input.kind,observedAt:clock(),evidence,writes:false,paidDispatch:false};return{...receipt,evidenceHash:digest(receipt)};
  }catch(error){const diagnostic=error?.diagnostic,c=String(error?.message||'');const safe=Error(BROKER_DIAGNOSTICS.includes(diagnostic)?'INT_GITHUB_'+diagnostic.slice('GH_BROKER_'.length):SAFE_ERRORS.has(c)?c:'GH_TRANSPORT_OR_CONTRACT_UNAVAILABLE');failureDiagnostics.set(safe,trace.seal());throw safe;}finally{clearTimeout(timer);deadline.abort();token=undefined;}
 }});
}
function validReceipt(r,sourceCommit){
 check(r&&Object.keys(r).sort().join(',')==='evidence,evidenceHash,installationId,kind,observedAt,paidDispatch,repository,repositoryId,sourceCommit,version,writes'&&r.version===VERSION&&r.repository===REPOSITORY&&r.sourceCommit===sourceCommit&&/^[a-f0-9]{40}$/.test(sourceCommit)&&r.installationId===171494892&&r.repositoryId===1284219633&&r.kind==='ci'&&Number.isSafeInteger(r.observedAt)&&r.writes===false&&r.paidDispatch===false,'GH_RECEIPT_INVALID');
 check(r.evidence&&Object.keys(r.evidence).join(',')==='runs'&&Array.isArray(r.evidence.runs)&&r.evidence.runs.length<=12,'GH_RECEIPT_INVALID');
 for(const x of r.evidence.runs)check(Object.keys(x).join(',')==='id,sourceCommit,status,conclusion'&&Number.isSafeInteger(x.id)&&x.id>0&&x.sourceCommit===sourceCommit&&['queued','in_progress','completed','waiting','pending','requested'].includes(x.status)&&[null,'success','failure','cancelled','skipped','timed_out','action_required','neutral','stale','startup_failure'].includes(x.conclusion),'GH_RECEIPT_INVALID');
 const {evidenceHash,...body}=r;check(evidenceHash===digest(body),'GH_RECEIPT_INVALID');return true;
}
module.exports={VERSION,REPOSITORY,PERMISSIONS,configuration,jwtClaims,tokenRequest,create,validReceipt,BROKER_DIAGNOSTICS,failureCode,diagnosticsFor,PHASES};
