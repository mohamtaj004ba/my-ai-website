'use strict';
const {createHash}=require('node:crypto');
const SPECIALIST=Object.freeze({profile:'chief-specialist',calls:2,maxMicros:600000,outputTokens:1500,requestTimeoutMs:90000,
  objective:'Inspect Legal dashboard imagery relevance and Growth pricing badge spacing on the pinned Preview. Read-only specialist findings with four fresh screenshots; stop after Website Visual QA. No independent model QA, code changes or external actions.'});
const isSpecialist=value=>value?.profile===SPECIALIST.profile;
function specialistScope(scope){return scope?.origin==='https://my-ai-website-lh7loz3s5-mohamtaj004bas-projects.vercel.app'&&scope.commit==='8133597ff2fc5b48e3de42336e9e06fa4191c2a8'&&JSON.stringify(scope.paths)===JSON.stringify(['/industries/legal','/#pricing']);}
function validArtifacts(artifacts,executionId,since,until){
  if(!/^exec_[a-zA-Z0-9_-]{1,80}$/.test(executionId||'')||!Array.isArray(artifacts)||artifacts.length!==4||!Number.isSafeInteger(since)||!Number.isSafeInteger(until))return false;
  const expected=new Set(['legal-1440','legal-390','pricing-1440','pricing-390']);
  for(const a of artifacts){
    if(!a||Object.keys(a).some(k=>!['path','viewport','sha256','capturedAt'].includes(k))||![1440,390].includes(a.viewport)||!/^[a-f0-9]{64}$/.test(a.sha256||'')||!Number.isSafeInteger(a.capturedAt)||a.capturedAt<since||a.capturedAt>until)return false;
    const name=['legal','pricing'].find(n=>a.path===executionId+'-'+n+'-'+a.viewport+'.png');
    if(!name||!expected.delete(name+'-'+a.viewport))return false;
  }
  return expected.size===0;
}
const evidenceHash=artifacts=>createHash('sha256').update(JSON.stringify(artifacts.map(a=>a.sha256))).digest('hex');
module.exports={SPECIALIST,isSpecialist,specialistScope,validArtifacts,evidenceHash};
