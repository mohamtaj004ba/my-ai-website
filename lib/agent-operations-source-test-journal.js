'use strict';
// Companion source-test permission on the EXISTING approval record/CAS, not a
// separate ledger. All identity and active-stage checks come from the broker.
const {randomBytes}=require('node:crypto'),{isDeepStrictEqual:equal}=require('node:util');
const d=require('./agent-operations-source-test-dispatch'),hash=require('./agent-operations-engineering-tools').hash;
const check=(v,c)=>{if(!v)throw Error(c);};
function create({tx,read,owner,audit,scope,scopedApproval,active,locate,assertCurrent,provider,clock=Date.now}){
 async function authorize(actor,c,a,expectedRevision){
  owner(actor);scope(actor,c);check(require('./agent-operations-implementation').enabled(c)&&!require('./agent-operations-implementation').taskFor(c)&&provider,'ENG_TEST_UNAVAILABLE');
  await assertCurrent(c.binding,'source-test-authorize');await provider.metadata();
  return tx((s,o,now)=>{const r=scopedApproval(o,actor,c,a);check(r.status==='prepared'&&r.revision===expectedRevision&&r.expiresAt>now&&!r.sourceTestAuthority,'ENG_TEST_PERMISSION');
   const body={version:d.PROFILE,id:randomBytes(16).toString('hex'),approvalHash:r.approvalHash,scopeHash:r.engineeringScope.scopeHash,expiresAt:r.expiresAt,status:'ready',maxRuns:1,executionClass:'exact-starter-patch-only',publicationAuthorized:false,independentlyAccepted:false};r.sourceTestAuthority={...body,hash:hash(body)};r.revision++;
   audit(o,actor,'engineering_source_tests_authorized',{approvalId:r.id,permissionHash:r.sourceTestAuthority.hash,executionClass:body.executionClass},now);return{approvalRevision:r.revision,permissionHash:r.sourceTestAuthority.hash,executionClass:body.executionClass,publicationAuthorized:false};});
 }
 const grant=(o,w)=>{const a=(o.approvals||[]).find(x=>x.id===w.approvalId),g=a?.sourceTestAuthority;if(!g)return null;const {hash:h,...body}=g;check(h===hash(body)&&g.approvalHash===a.approvalHash&&g.scopeHash===a.engineeringScope?.scopeHash&&g.version===d.PROFILE&&g.maxRuns===1&&g.executionClass==='exact-starter-patch-only'&&g.publicationAuthorized===false&&g.independentlyAccepted===false,'ENG_TEST_PERMISSION');return g;};
 async function execute(t,c,proposal,{signal}={}){
  // Absence of a NEW explicit owner permission preserves historical behavior.
  const observed=await read(),found=locate(observed.operations,t);if(!grant(observed.operations,found.w))return null;
  check(provider&&t.stage==='specialist'&&!require('./agent-operations-implementation').taskFor(c),'ENG_TEST_UNAVAILABLE');
  const b=c.binding,impl=require('./agent-operations-implementation'),source=impl.snapshot().text;
  const normalized=impl.proposal(proposal,c);check(normalized.edits.length===1,'ENG_TEST_PROPOSAL');const edit=normalized.edits[0];
  const job=d.prepare({binding:{ownerHash:b.ownerHash,workspaceHash:b.workspaceHash,planId:b.planId,taskId:b.taskId+'_source_test',executionId:b.executionId+'_source_test',sourceCommit:b.runtime.sourceCommit,releaseHash:b.runtime.release.digest,deploymentId:b.runtime.deploymentId},baseline:source,patched:source.replace(edit.beforeText,edit.afterText),proposalHash:hash(proposal)});
  let closed;
  const journal={
   claim:manifest=>tx((s,o,now)=>{const {w,r}=active(o,t,c,now),g=grant(o,w);check(g?.status==='ready'&&g.expiresAt>now&&!r.sourceTestRun,'ENG_TEST_PERMISSION');
    check(!o.workflows.some(v=>(v.attempts||[]).some(x=>x.sourceTestRun&&['claimed','running','cleanup-unconfirmed'].includes(x.sourceTestRun.status))),'ENG_TEST_SERIAL');
    const permit={id:randomBytes(16).toString('hex'),manifestHash:manifest.hash,expiresAt:Math.min(g.expiresAt,now+300000)};g.status='consumed';g.hash=hash({...g,hash:undefined});r.sourceTestRun={version:d.PROFILE,status:'claimed',permit,manifest:structuredClone(manifest),at:now};
    audit(o,{kind:'service',id:r.principalHash},'engineering_source_test_claimed',{executionId:r.executionId,permitId:permit.id,manifestHash:manifest.hash,providerName:'callercore-test-'+permit.id},now);return permit;}),
   verify:async(permit,manifest)=>{check(!signal?.aborted,'ENG_TEST_CANCELLED');await assertCurrent(c.binding,'source-test-run');const s=await read(),{w,r}=active(s.operations,t,c,clock()),g=grant(s.operations,w);check(g?.status==='consumed'&&g.expiresAt>clock()&&permit.expiresAt>clock()&&r.sourceTestRun&&equal(r.sourceTestRun.permit,permit)&&equal(r.sourceTestRun.manifest,manifest)&&['claimed','running'].includes(r.sourceTestRun.status),'ENG_TEST_REVOKED');},
   started:(permit,sessionId)=>tx((s,o,now)=>{const {r}=active(o,t,c,now);check(r.sourceTestRun?.permit.id===permit.id&&r.sourceTestRun.status==='claimed','ENG_TEST_PERMISSION');r.sourceTestRun.status='running';r.sourceTestRun.sessionId=sessionId;audit(o,{kind:'service',id:r.principalHash},'engineering_source_test_started',{permitId:permit.id,sessionId},now);return true;}),
   close:async(permit,receipt)=>{closed=await tx((s,o,now)=>{const {r}=locate(o,t);check(r.sourceTestRun?.permit.id===permit.id&&!r.sourceTestRun.receipt,'ENG_TEST_PERMISSION');r.sourceTestRun.status=receipt.stopConfirmed?receipt.status:'cleanup-unconfirmed';r.sourceTestRun.receipt=structuredClone(receipt);r.sourceTestRun.completedAt=now;audit(o,{kind:'service',id:r.principalHash},'engineering_source_test_closed',{permitId:permit.id,receiptHash:receipt.hash,status:receipt.status,stopConfirmed:receipt.stopConfirmed},now);return structuredClone(receipt);},{diagnostic:true,maintenance:true});}
  };
  await d.dispatch({job,journal,provider,signal,clock});check(closed?.status==='completed'&&closed.stopConfirmed,'ENG_TEST_SHUTDOWN');return{manifest:job.manifest,receipt:closed};
 }
 return{metadata:async actor=>{owner(actor);check(provider,'ENG_TEST_UNAVAILABLE');return provider.metadata();},authorize,execute};
}
module.exports={create};
