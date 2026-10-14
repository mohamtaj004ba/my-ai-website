'use strict';
// Inactive preparation boundary. Only the server credential broker may mint installation tokens.
// The existing gateway must provide durable admission/revalidation; this module grants no authority.
const {createHash}=require('node:crypto');
const REPOSITORY='mohamtaj004ba/my-ai-website', VERSION='github-app-read-boundary-v1';
const PERMISSIONS=Object.freeze({metadata:'read',contents:'read',actions:'read'});
const SAFE_ERRORS=new Set(['GH_CONFIGURATION_REQUIRED','GH_APP_ID_INVALID','GH_PROVIDER_DENIED','GH_RESPONSE_BOUNDS','GH_REQUEST_DENIED','GH_OPERATION_DISABLED','GH_TRUSTED_DEPENDENCY_REQUIRED','GH_CANCELLED','GH_TIMEOUT','GH_AUTHORITY_DENIED','GH_CREDENTIAL_SCOPE_DENIED','GH_REPOSITORY_SCOPE_DENIED','GH_RESPONSE_INVALID']);
const fail=c=>{throw Error(c);},check=(x,c)=>{if(!x)fail(c);};
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function configuration(c){check(c&&c.environment==='preview'&&c.repository===REPOSITORY&&Number.isSafeInteger(c.repositoryId)&&c.repositoryId>0&&Number.isSafeInteger(c.installationId)&&c.installationId>0&&typeof c.credentialReference==='string'&&/^[a-zA-Z0-9:_-]{1,160}$/.test(c.credentialReference),'GH_CONFIGURATION_REQUIRED');return c;}
function jwtClaims(appClientId,now=Date.now()){check(typeof appClientId==='string'&&/^[a-zA-Z0-9_]{1,80}$/.test(appClientId)&&Number.isSafeInteger(now),'GH_APP_ID_INVALID');return{iat:Math.floor(now/1000)-60,exp:Math.floor(now/1000)+480,iss:appClientId};}
function tokenRequest(c){configuration(c);return{installationId:c.installationId,repository_ids:[c.repositoryId],permissions:{...PERMISSIONS},credentialReference:c.credentialReference};}
async function boundedJson(response){check(response?.ok,'GH_PROVIDER_DENIED');check(Number(response.headers.get('content-length')||0)<=250000,'GH_RESPONSE_BOUNDS');let size=0;const parts=[];for await(const p of response.body){size+=p.length;check(size<=250000,'GH_RESPONSE_BOUNDS');parts.push(p);}return JSON.parse(Buffer.concat(parts).toString('utf8'));}
function operation(input){check(input&&Object.keys(input).every(k=>['kind','sourceCommit'].includes(k))&&/^[a-f0-9]{40}$/.test(input.sourceCommit||''),'GH_REQUEST_DENIED');const prefix='/repos/'+REPOSITORY;switch(input.kind){case 'commit':return prefix+'/commits/'+input.sourceCommit;case 'ci':return prefix+'/actions/runs?head_sha='+input.sourceCommit+'&per_page=12';default:fail('GH_OPERATION_DISABLED');}}
function create({config,credentialBroker,authorize,fetchImpl=fetch,clock=Date.now}={}){
 config=Object.freeze({...configuration(config)});check(typeof credentialBroker==='function'&&typeof authorize==='function','GH_TRUSTED_DEPENDENCY_REQUIRED');
 return Object.freeze({async inspect(input,{signal}={}){
  input=Object.freeze({...input});
  const path=operation(input),start=clock(),deadline=new AbortController(),timer=setTimeout(()=>deadline.abort(),6000);let token;
  const executionSignal=signal?AbortSignal.any([signal,deadline.signal]):deadline.signal;
  async function bounded(p){if(executionSignal.aborted)fail(signal?.aborted?'GH_CANCELLED':'GH_TIMEOUT');let stop;try{return await Promise.race([p,new Promise((_,reject)=>{stop=()=>reject(Error(signal?.aborted?'GH_CANCELLED':'GH_TIMEOUT'));executionSignal.addEventListener('abort',stop,{once:true});})]);}finally{if(stop)executionSignal.removeEventListener('abort',stop);}}
  // No retries and no token cache; local or provider revocation must be revalidated for every read.
  async function guard(){check(!signal?.aborted,'GH_CANCELLED');check(!executionSignal.aborted&&clock()-start<6000,'GH_TIMEOUT');check(await bounded(Promise.resolve().then(()=>authorize()))===true,'GH_AUTHORITY_DENIED');}
  async function get(path){await guard();const r=await bounded(fetchImpl('https://api.github.com'+path,{method:'GET',redirect:'error',signal:executionSignal,headers:{Accept:'application/vnd.github+json','User-Agent':'CallerCore-scoped-GitHub-App','X-GitHub-Api-Version':'2022-11-28',Authorization:'Bearer '+token}}));return bounded(boundedJson(r));}
  try{
   await guard();const lease=await bounded(credentialBroker(tokenRequest(config),{signal:executionSignal}));await guard();
   check(lease&&typeof lease.token==='string'&&/^ghs_[A-Za-z0-9_]{8,255}$/.test(lease.token)&&lease.installationId===config.installationId&&lease.repositoryId===config.repositoryId&&lease.repository===REPOSITORY&&Number.isSafeInteger(lease.expiresAt)&&lease.expiresAt>clock()+10000&&lease.expiresAt<=clock()+3600000,'GH_CREDENTIAL_SCOPE_DENIED');
   check(lease.permissions&&Object.entries(lease.permissions).every(([key,value])=>PERMISSIONS[key]==='read'&&value==='read')&&Object.keys(PERMISSIONS).every(k=>lease.permissions[k]==='read'),'GH_CREDENTIAL_SCOPE_DENIED');token=lease.token;
   const inventory=await get('/installation/repositories?per_page=2');
   check(inventory.total_count===1&&Array.isArray(inventory.repositories)&&inventory.repositories.length===1&&inventory.repositories[0].id===config.repositoryId&&inventory.repositories[0].full_name===REPOSITORY,'GH_REPOSITORY_SCOPE_DENIED');
   const raw=await get(path);let evidence;
   if(input.kind==='commit'){check(raw.sha===input.sourceCommit&&Array.isArray(raw.parents)&&raw.parents.length<=8,'GH_RESPONSE_INVALID');evidence={sha:raw.sha,parentShas:raw.parents.map(p=>{check(/^[a-f0-9]{40}$/.test(p.sha),'GH_RESPONSE_INVALID');return p.sha;})};}
   else{check(Array.isArray(raw.workflow_runs)&&raw.workflow_runs.length<=12,'GH_RESPONSE_INVALID');evidence={runs:raw.workflow_runs.map(r=>{check(Number.isSafeInteger(r.id)&&r.id>0&&r.head_sha===input.sourceCommit&&['queued','in_progress','completed','waiting','pending','requested'].includes(r.status)&&[null,'success','failure','cancelled','skipped','timed_out','action_required','neutral','stale','startup_failure'].includes(r.conclusion),'GH_RESPONSE_INVALID');return{id:r.id,sourceCommit:r.head_sha,status:r.status,conclusion:r.conclusion};})};}
   await guard();const receipt={version:VERSION,repository:REPOSITORY,installationId:config.installationId,repositoryId:config.repositoryId,sourceCommit:input.sourceCommit,kind:input.kind,observedAt:clock(),evidence,writes:false,paidDispatch:false};return{...receipt,evidenceHash:digest(receipt)};
  }catch(error){const c=String(error?.message||'');throw Error(SAFE_ERRORS.has(c)?c:'GH_TRANSPORT_OR_CONTRACT_UNAVAILABLE');}finally{clearTimeout(timer);token=undefined;}
 }});
}
module.exports={VERSION,REPOSITORY,PERMISSIONS,configuration,jwtClaims,tokenRequest,create};
