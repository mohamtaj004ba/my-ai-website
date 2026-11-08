'use strict';
// Packaging smoke checks only. Full exact-source CI and release review remain required.
const path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const tests=['syntax.test.js','asset-links.test.js','preview-build-identity.test.js'];
let phase='contract-preflight';
function main(){
  // Never generate or repair the lock here: stale source must fail closed.
  const release=require('../lib/agent-operations-contracts').assertRelease();
  phase='smoke-tests';const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^OPENAI_|^CALLERCORE_|^VERCEL_/i.test(key)));
  const result=spawnSync(process.execPath,['--require',path.join(root,'tests/helpers/agent-operations-offline-only.cjs'),'--test',...tests.map(file=>path.join(root,'tests',file))],{cwd:root,env,stdio:'inherit',windowsHide:true,timeout:60000});
  if(result.error||result.signal||result.status!==0)throw Error('Deployment smoke checks failed');
  phase='source-pack';const source=require('./prepare-repository-source.cjs').prepare({commit:process.env.VERCEL_GIT_COMMIT_SHA,onPhase:value=>{phase=value;}});
  console.log(JSON.stringify({repositorySource:source,privateServerAsset:true,publicOutput:'public-dist'}));
  console.log(JSON.stringify({deploymentBuild:'smoke-checks-passed',release,fullRegressionExecuted:false,qualificationGranted:false,modelRequests:0,publicationAuthorized:false}));
}
if(require.main===module)try{main();}catch(error){console.error(JSON.stringify({deploymentBuild:'failed',phase,code:/^ENG_[A-Z_]+$/.test(error?.message||'')?error.message:'ENG_BUILD_PHASE_FAILED',...(error?.message==='ENG_REPOSITORY_BUILD_DIRTY'&&[error.gitignoreChanged,error.lockfileChanged,error.otherTrackedChanged].every(v=>typeof v==='boolean')?{gitignoreChanged:error.gitignoreChanged,lockfileChanged:error.lockfileChanged,otherTrackedChanged:error.otherTrackedChanged,...(Number.isSafeInteger(error.dirtyPathCount)&&Array.isArray(error.dirtyPaths)&&error.dirtyPaths.length<=20&&error.dirtyPaths.every(p=>typeof p==='string'&&/^[A-Za-z0-9_. /-]{1,500}$/.test(p))?{dirtyPathCount:error.dirtyPathCount,dirtyPaths:error.dirtyPaths}:{})}:{}),qualificationGranted:false,modelRequests:0}));process.exitCode=1;}
module.exports={main};
