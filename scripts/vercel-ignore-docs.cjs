'use strict';
// Vercel: 0 skips, 1 builds. Unknown state always builds; never a verification receipt.
const {execFileSync}=require('node:child_process');
const SHA=/^[a-f0-9]{40}$/,docs=p=>p==='CALLERCORE_PROJECT_STATE.md'||p==='docs/AGENT_OPERATIONS_CALL_ROW_ADOPTION_REVIEW.md'||p==='docs/AGENT_OPERATIONS_FAILURE_MODES.json'||p==='docs/AGENT_OPERATIONS_ENGINEERING_ACTIVATION.md'||/^docs\/AGENT_OPERATIONS_PHASE_[A-Z]\.md$/.test(p)||/^docs\/engineering-changes\/[a-z0-9-]+\.json$/.test(p);
function decide(env,git=args=>execFileSync('git',args,{encoding:'utf8',windowsHide:true,timeout:5000,maxBuffer:2000000})){try{
 if(env.VERCEL_ENV!=='preview'||env.VERCEL_GIT_COMMIT_REF!=='feature/callercore-dashboards'||!SHA.test(env.VERCEL_GIT_PREVIOUS_SHA||'')||!SHA.test(env.VERCEL_GIT_COMMIT_SHA||''))return{skip:false,reason:'unconfirmed-preview-context'};
 const previous=env.VERCEL_GIT_PREVIOUS_SHA,current=env.VERCEL_GIT_COMMIT_SHA;
 if(git(['rev-parse','HEAD']).trim()!==current)return{skip:false,reason:'checkout-mismatch'};
 git(['merge-base','--is-ancestor',previous,current]);
 const paths=git(['diff','--name-only','--no-renames','-z',previous,current,'--']).split('\0').filter(Boolean);
 if(!paths.length||paths.some(p=>!docs(p)))return{skip:false,reason:'runtime-or-unknown-change'};
 for(const ref of [previous,current])for(const p of paths){const tree=git(['ls-tree',ref,'--',p]);if(tree&&!tree.startsWith('100644 blob '))return{skip:false,reason:'nonregular-document'};}
 return{skip:true,reason:'only-allowlisted-documents-since-last-successful-branch-deployment',previous,current};
 }catch{return{skip:false,reason:'comparison-unavailable-build-required'};}}
if(require.main===module){const r=decide(process.env);console.log(JSON.stringify({...r,verificationGranted:false,executionAuthority:false}));process.exitCode=r.skip?0:1;}
module.exports={decide,docs};
