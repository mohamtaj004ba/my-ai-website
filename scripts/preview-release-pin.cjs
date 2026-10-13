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
async function pin({alias,checkpoint,release,headers,fetcher=fetch,git}){
 if(alias!=='https://my-ai-website-git-feature-caller-d75cb2-mohamtaj004bas-projects.vercel.app')throw Error('unapproved-alias');
 const read=async url=>{const r=await fetcher(url+'/api/account?action=preview-build',{headers,redirect:'error',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('identity-http-'+r.status);return r.json();};
 const a=await read(alias),documentationChanges=validate(a,{checkpoint,release,git});
 const exact=await read(a.url);validate(exact,{checkpoint,release,git});pair(a,exact);
 return {version:'preview-release-pin-v1',checkpoint,source:a.sha,deploymentId:a.deploymentId,url:a.url,release,documentationChanges,modelRequests:0};
}
async function main(){
 const release=require('../lib/agent-operations-contracts').assertRelease();
 const headers={'x-vercel-protection-bypass':process.env.VERCEL_AUTOMATION_BYPASS_SECRET,'x-qa-secret':process.env.VERCEL_AUTOMATION_BYPASS_SECRET};
 if(!headers['x-qa-secret'])throw Error('missing-authentication');
 const attempts=[];let result;
 for(let n=0;n<36;n++){
  try{result=await pin({alias:process.env.PREVIEW_URL,checkpoint:process.env.GITHUB_SHA,release,headers});break;}
  catch(e){const code=/^(invalid-source|application-source-mismatch|invalid-identity|wrong-preview-context|release-mismatch|immutable-identity-mismatch|immutable-release-mismatch|identity-http-\d+)$/.test(e.message)?e.message:'identity-unconfirmed';attempts.push({attempt:n+1,code});}
  await new Promise(r=>setTimeout(r,5000));
 }
 fs.mkdirSync('qa-artifacts',{recursive:true});fs.writeFileSync('qa-artifacts/release-pin.json',JSON.stringify({attempts,result:result||null},null,2));
 if(!result)throw Error('Exact Preview release unconfirmed; see sanitized release-pin evidence');
 fs.appendFileSync(process.env.GITHUB_ENV,'PREVIEW_URL='+result.url+'\n');console.log(JSON.stringify(result));
}
if(require.main===module)main().catch(()=>{console.error('Preview release pin failed closed; no paid execution.');process.exitCode=1;});
module.exports={documentation,equivalent,validate,pair,pin};
