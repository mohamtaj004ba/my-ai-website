'use strict';
// Read-only authentication/capture verification, entirely separate from paid worker execution.
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {capture}=require('./agent-operations-capture.cjs');
const {ORIGIN}=require('./agent-operations-preview-access.cjs');
async function main(){
  if(process.env.CALLERCORE_AGENTOPS_PAID_ENABLED!=='false'||process.env.CALLERCORE_AGENTOPS_WORKER_MODE!=='mock')throw new Error('Preflight requires paid disabled and mock mode');
  const scope={origin:ORIGIN,commit:'8133597ff2fc5b48e3de42336e9e06fa4191c2a8',paths:['/industries/legal','/#pricing']};
  const executionId='exec_preflight_'+randomUUID(),outputDir='artifacts/agent-operations/'+executionId;
  const images=await capture(scope,{executionId,outputDir,signal:AbortSignal.timeout(90000),oidcToken:process.env.VERCEL_OIDC_TOKEN});
  const report={executionId,scope,paidEnabled:false,modelRequests:0,images:images.map(({path,viewport,sha256})=>({path,viewport,sha256}))};
  await fs.writeFile(path.join(outputDir,'preflight.json'),JSON.stringify(report,null,2),{flag:'wx'});
  process.stdout.write(JSON.stringify({executionId,verifiedScreenshots:images.length,modelRequests:0})+'\n');
}
if(require.main===module)main().catch(()=>{process.stderr.write('Preview preflight unconfirmed; no paid execution attempted.\n');process.exitCode=1;});
module.exports={main};
