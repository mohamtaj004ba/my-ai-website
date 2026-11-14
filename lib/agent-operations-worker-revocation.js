'use strict';
// Revocation-only domain-separated capability, derivable before initialization.
// It grants no activation, renewal, task, capture, assessor, or provider authority.
const crypto=require('node:crypto');
function derive({workerSecret,approval,runtime}={}){
 if(typeof workerSecret!=='string'||workerSecret.length<32||!/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(runtime?.origin||'')||!/^[a-f0-9]{40}$/.test(runtime?.commit||'')||!approval||approval.sourceCommit!==runtime.commit||!/^pilot_[A-Za-z0-9_-]{8,60}$/.test(approval.id||'')||!/^wf_[A-Za-z0-9_-]+$/.test(approval.workflowId||'')||!/^[a-f0-9]{64}$/.test(approval.contractHash||''))throw Error('Exact worker revocation binding required');
 const approvalHash=crypto.createHash('sha256').update(JSON.stringify(approval)).digest('hex');
 return crypto.createHmac('sha256',workerSecret).update('callercore-worker-revocation-only-v1\0').update(JSON.stringify({origin:runtime.origin,commit:runtime.commit,approvalHash})).digest('hex');
}
module.exports={derive};
