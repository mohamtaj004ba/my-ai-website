'use strict';
// Review contract only: caller persists through the existing operations CAS journal.
// Authentication is supplied exclusively by the existing server reviewer policy.
const {createHash,randomUUID}=require('node:crypto');
const {isDeepStrictEqual:equal}=require('node:util');
const VERSION='engineering-independent-review-v1';
const DIMENSIONS=Object.freeze(['problemSupport','correctionFit','affectedScope','userImpact','riskSeverity','verification','permissionScope']);
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const identity=x=>createHash('sha256').update(String(x)).digest('hex');
const check=(v,m)=>{if(!v)throw Error(m);};
const text=(x,n)=>typeof x==='string'&&x.trim().length>0&&x.length<=n;
const sha=x=>/^[a-f0-9]{64}$/.test(x||'');
const exact=(x,k)=>x&&typeof x==='object'&&!Array.isArray(x)&&equal(Object.keys(x).sort(),k.slice().sort());
function binding(s){
 check(s&&s.environment==='preview'&&s.branch==='feature/callercore-dashboards'&&s.status==='completed'&&s.cancelled===false,'ENG_REVIEW_SCOPE');
 check(['planId','taskId','executionId','deploymentId'].every(k=>text(s[k],160))&&Number.isSafeInteger(s.taskRevision)&&s.taskRevision>=0&&/^[a-f0-9]{40}$/.test(s.sourceCommit||'')&&[s.ownerHash,s.workspaceHash,s.releaseHash].every(sha),'ENG_REVIEW_BINDING');
 check(text(s.workspaceId,200)&&identity(s.workspaceId)===s.workspaceHash,'ENG_REVIEW_WORKSPACE');
 check(Array.isArray(s.implementerHashes)&&s.implementerHashes.length>0&&s.implementerHashes.every(sha)&&Array.isArray(s.proposals)&&s.proposals.length>0&&s.proposals.length<=16&&new Set(s.proposals.map(p=>p.id)).size===s.proposals.length,'ENG_REVIEW_PROPOSALS');
 check(s.proposals.every(p=>text(p.id,100)&&Array.isArray(p.evidence)&&p.evidence.length>0&&p.evidence.every(e=>sha(e.excerptHash||e.sha256))),'ENG_REVIEW_EVIDENCE');
 return{version:VERSION,planId:s.planId,taskId:s.taskId,executionId:s.executionId,taskRevision:s.taskRevision,ownerHash:s.ownerHash,workspaceHash:s.workspaceHash,sourceCommit:s.sourceCommit,deploymentId:s.deploymentId,releaseHash:s.releaseHash,proposalHash:hash(s.proposals),implementerHashes:[...s.implementerHashes],evidenceHash:hash(s.proposals.map(p=>({id:p.id,evidence:p.evidence})))};
}
function decisions(s,ds){
 check(Array.isArray(ds)&&ds.length===s.proposals.length&&new Set(ds.map(d=>d.proposalId)).size===ds.length,'ENG_REVIEW_COMPLETENESS');
 for(const d of ds){
  const p=s.proposals.find(p=>p.id===d.proposalId);
  check(p&&exact(d,['proposalId','decision','reason','evidenceHashes','assessments'])&&['accepted','rejected','unresolved'].includes(d.decision)&&text(d.reason,1600),'ENG_REVIEW_DECISION');
  const allowed=new Set(p.evidence.flatMap(e=>[e.excerptHash,e.sha256].filter(sha)));
  check(Array.isArray(d.evidenceHashes)&&d.evidenceHashes.length>0&&new Set(d.evidenceHashes).size===d.evidenceHashes.length&&d.evidenceHashes.every(h=>allowed.has(h)),'ENG_REVIEW_REFERENCE');
  check(exact(d.assessments,DIMENSIONS)&&DIMENSIONS.every(k=>{const a=d.assessments[k];return exact(a,['outcome','reason','evidenceHashes'])&&['supported','contradicted','insufficient-evidence'].includes(a.outcome)&&text(a.reason,1000)&&Array.isArray(a.evidenceHashes)&&a.evidenceHashes.length>0&&new Set(a.evidenceHashes).size===a.evidenceHashes.length&&a.evidenceHashes.every(h=>d.evidenceHashes.includes(h));}),'ENG_REVIEW_ASSESSMENTS');
  const outcomes=DIMENSIONS.map(k=>d.assessments[k].outcome);
  check(d.decision!=='accepted'||outcomes.every(x=>x==='supported'),'ENG_REVIEW_UNSUPPORTED_ACCEPTANCE');
  check(d.decision!=='rejected'||outcomes.includes('contradicted'),'ENG_REVIEW_UNSUPPORTED_REJECTION');
  check(d.decision!=='unresolved'||outcomes.includes('insufficient-evidence'),'ENG_REVIEW_UNCERTAINTY_REQUIRED');
 }
 return structuredClone(ds);
}
function createEngineeringReview({assertReviewer,clock=Date.now}={}){
 check(typeof assertReviewer==='function','ENG_REVIEW_POLICY_REQUIRED');
 async function authorize(actor,s,op){
  const b=binding(s),p=await assertReviewer(actor,structuredClone(s),op,{ownerHash:s.ownerHash,originalWorkspaceId:s.workspaceId||null});
  check(p&&p.role==='workspace-owner'&&text(p.id,320)&&text(p.workspaceId,200)&&identity(p.workspaceId)===b.workspaceHash,'ENG_REVIEW_IDENTITY');
  // Current owner policy explicitly returns false. No body claim can elevate this.
  if(op==='attest')check(p.independenceVerified===true&&!b.implementerHashes.includes(identity(p.id))&&identity(p.id)!==b.ownerHash,'ENG_REVIEW_INDEPENDENCE_UNAVAILABLE');
  return{b,p};
 }
 async function readBundle(actor,s){const {b}=await authorize(actor,s,'read');return{version:VERSION,binding:b,bindingHash:hash(b),proposals:structuredClone(s.proposals),dimensions:[...DIMENSIONS],publicationAuthorized:false,acceptedWork:false,independence:'requires-server-verified-separate-reviewer'};}
 async function prepare(actor,s,input){
  const {b,p}=await authorize(actor,s,'attest');
  check(exact(input,['bindingHash','idempotencyKey','decisions'])&&input.bindingHash===hash(b)&&/^[A-Za-z0-9_-]{16,80}$/.test(input.idempotencyKey||''),'ENG_REVIEW_STALE_OR_INVALID');
  const at=clock();check(Number.isSafeInteger(at)&&at>=0,'ENG_REVIEW_CLOCK');
  const r={version:VERSION,id:'engreview_'+randomUUID(),at,binding:b,bindingHash:hash(b),reviewerHash:identity(p.id),reviewerRole:p.role,workspaceHash:identity(p.workspaceId),independence:'server-verified-separate-reviewer',idempotencyHash:hash({taskId:s.taskId,reviewer:identity(p.id),key:input.idempotencyKey}),payloadHash:hash(input),decisions:decisions(s,input.decisions),publicationAuthorized:false,operationalAuthority:false,acceptedWork:false,qualification:'Authenticated reviewer assessments; contract validity does not prove human inspection or live-model accuracy.'};r.hash=hash(r);return r;
 }
 return{readBundle,prepare};
}
function validateRecord(s,r){const {hash:stored,...body}=r||{};check(stored===hash(body)&&r.version===VERSION&&/^engreview_[0-9a-f-]{36}$/.test(r.id||'')&&Number.isSafeInteger(r.at)&&r.at>=0&&r.reviewerRole==='workspace-owner'&&sha(r.payloadHash)&&sha(r.idempotencyHash)&&equal(r.binding,binding(s))&&r.bindingHash===hash(r.binding)&&r.publicationAuthorized===false&&r.operationalAuthority===false&&r.acceptedWork===false&&sha(r.reviewerHash)&&r.reviewerHash!==s.ownerHash&&!s.implementerHashes.includes(r.reviewerHash)&&r.workspaceHash===s.workspaceHash&&r.independence==='server-verified-separate-reviewer','ENG_REVIEW_RECORD_INVALID');decisions(s,r.decisions);return true;}
module.exports={VERSION,DIMENSIONS,hash,binding,decisions,createEngineeringReview,validateRecord};

