'use strict';
// Packaging smoke checks only. Full exact-source CI and release review remain required.
const path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const tests=['syntax.test.js','asset-links.test.js','preview-build-identity.test.js'];
function main(){
  // Never generate or repair the lock here: stale source must fail closed.
  const release=require('../lib/agent-operations-contracts').assertRelease();
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^OPENAI_|^CALLERCORE_|^VERCEL_/i.test(key)));
  const result=spawnSync(process.execPath,['--require',path.join(root,'tests/helpers/agent-operations-offline-only.cjs'),'--test',...tests.map(file=>path.join(root,'tests',file))],{cwd:root,env,stdio:'inherit',windowsHide:true,timeout:60000});
  if(result.error||result.signal||result.status!==0)throw Error('Deployment smoke checks failed');
  console.log(JSON.stringify({deploymentBuild:'smoke-checks-passed',release,fullRegressionExecuted:false,qualificationGranted:false,modelRequests:0,publicationAuthorized:false}));
}
if(require.main===module)try{main();}catch{console.error('Deployment smoke checks failed; full CI and release qualification remain required.');process.exitCode=1;}
module.exports={main};
