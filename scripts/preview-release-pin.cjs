'use strict';
// Read-only identity verification. Never creates execution permissions or invokes a model.
const {execFileSync}=require('node:child_process'),fs=require('node:fs');
const BRANCH='feature/callercore-dashboards';
const SHA=/^[a-f0-9]{40}$/;
function documentation(p){return p==='CALLERCORE_PROJECT_STATE.md'||p==='docs/AGENT_OPERATIONS_FAILURE_MODES.json'||/^docs\/[a-zA-Z0-9_/-]+\.md$/.test(p)||/^docs\/engineering-changes\/[a-z0-9-]+\.json$/.test(p);}
function equivalent(source,checkpoint,git=args=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']})){
 if(!SHA.test(source)||!SHA.test(checkpoint))throw Error('invalid-source');
 git(['merge-base','--is-ancestor',source,checkpoint]);
 const paths=git(['diff','--name-only','--no-renames','-z',source,checkpoint,'--']).split('\0').filter(Boolean);
 if(paths.some(p=>!documentation(p)))throw Error('application-source-mismatch');
 return paths;
}
function validate(identity,{checkpoint,release,git}){
 if(!identity||!SHA.test(identity.sha)||!/^dpl_[A-Za-z0-9]+$/.test(identity.deploymentId||'')||!/^https:\/\/my-ai-website-[a-z0-9-]+\.vercel\.app$/.test(identity.url||''))throw Error('invalid-identity');
 if(identity.environment!=='preview'||identity.branch!==BRANCH||identity.projectId!=='prj_AkD7VoSNCE6fRYXQnXkX1ywGqjLX')throw Error('wrong-preview-context');
 if(identity.release?.version!==release.version||identity.release?.digest!==release.digest)throw Error('release-mismatch');
 return equivalent(identity.sha,checkpoint,git);
}
function pair(alias,exact){for(const k of ['sha','url','deploymentId','projectId','environment','branch'])if(alias[k]!==exact[k])throw Error('immutable-identity-mismatch');if(JSON.stringify(alias.release)!==JSON.stringify(exact.release))throw Error('immutable-release-mismatch');}
async function pin({alias,checkpoint,release,headers,fetcher=fetch,git,signal}){
 if(alias!=='https://my-ai-website-git-feature-caller-d75cb2-mohamtaj004bas-projects.vercel.app')throw Error('unapproved-alias');
 const read=async url=>{if(signal?.aborted)throw Error('identity-unconfirmed');const requestSignal=AbortSignal.timeout(10000);const r=await fetcher(url+'/api/account?action=preview-build',{headers,redirect:'error',signal:signal?AbortSignal.any([signal,requestSignal]):requestSignal});if(!r.ok)throw Error('identity-http-'+r.status);return r.json();};
 const a=await read(alias),documentationChanges=validate(a,{checkpoint,release,git});
 const exact=await read(a.url);validate(exact,{checkpoint,release,git});pair(a,exact);
 return {version:'preview-release-pin-v1',checkpoint,source:a.sha,deploymentId:a.deploymentId,url:a.url,release,documentationChanges,modelRequests:0};
}
function attemptCode(e){return /^(invalid-source|application-source-mismatch|invalid-identity|wrong-preview-context|release-mismatch|immutable-identity-mismatch|immutable-release-mismatch|identity-http-\d+)$/.test(e?.message)?e.message:'identity-unconfirmed';}
function pause(ms,signal){return new Promise(resolve=>{let timer;const done=()=>{clearTimeout(timer);signal.removeEventListener('abort',done);resolve();};if(signal.aborted)return resolve();signal.addEventListener('abort',done,{once:true});timer=setTimeout(done,ms);});}
// Wait for this exact build, never accept an old alias. One wall-clock deadline
// also bounds hung fetch/body promises; late completion cannot write evidence.
async function waitForPin({attempt,durationMs=600000,intervalMs=5000}={}){
 if(typeof attempt!=='function'||!Number.isSafeInteger(durationMs)||durationMs<1||durationMs>600000||!Number.isSafeInteger(intervalMs)||intervalMs<1||intervalMs>5000)throw Error('invalid-pin-wait');
 const controller=new AbortController(),attempts=[],expired=Symbol('pin-deadline');let timer,result;
 const deadline=new Promise(resolve=>{timer=setTimeout(()=>{resolve(expired);controller.abort();},durationMs);});
 try{for(let n=0;n<120&&!controller.signal.aborted;n++){
  const pending=Promise.resolve().then(()=>{if(controller.signal.aborted)throw Error('identity-unconfirmed');return attempt({signal:controller.signal});}).then(result=>({result}),error=>({error}));
  const out=await Promise.race([pending,deadline]);if(out===expired){attempts.push({attempt:n+1,code:'identity-deadline'});break;}
  if(out.result){result=out.result;break;}attempts.push({attempt:n+1,code:attemptCode(out.error)});
  if(n<119)await pause(intervalMs,controller.signal);
 }}finally{clearTimeout(timer);controller.abort();}
 return{attempts,result:result||null};
}
async function main(){
 const release=require('../lib/agent-operations-contracts').assertRelease();
 const headers={'x-vercel-protection-bypass':process.env.VERCEL_AUTOMATION_BYPASS_SECRET,'x-qa-secret':process.env.VERCEL_AUTOMATION_BYPASS_SECRET};
 if(!headers['x-qa-secret'])throw Error('missing-authentication');
 const {attempts,result}=await waitForPin({attempt:({signal})=>pin({alias:process.env.PREVIEW_URL,checkpoint:process.env.GITHUB_SHA,release,headers,signal})});
 fs.mkdirSync('qa-artifacts',{recursive:true});fs.writeFileSync('qa-artifacts/release-pin.json',JSON.stringify({attempts,result:result||null},null,2));
 if(!result)throw Error('Exact Preview release unconfirmed; see sanitized release-pin evidence');
 fs.appendFileSync(process.env.GITHUB_ENV,'PREVIEW_URL='+result.url+'\n');console.log(JSON.stringify(result));
}
if(require.main===module)main().catch(()=>{console.error('Preview release pin failed closed; no paid execution.');process.exitCode=1;});
module.exports={documentation,equivalent,validate,pair,pin,waitForPin};
